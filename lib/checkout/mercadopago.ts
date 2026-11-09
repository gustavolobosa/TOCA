import "server-only";
import { plans } from "@/lib/pricing";
import { CheckoutError, checkoutSecret, testBuyerEmail, testSellerId } from "./config";
import type { CheckoutSession } from "./session";
import { claimAttempt, getAttempt, saveAttempt } from "./store";

type Subscription = {
  id: string; status: string; external_reference: string; collector_id: number; init_point: string;
  auto_recurring: { transaction_amount: number; currency_id: string; frequency: number; frequency_type: string };
};
type Payment = { id: number; status: string; status_detail: string; transaction_amount: number; currency_id: string; external_reference: string; collector_id: number; payer?: { email?: string } };
class ProviderError extends CheckoutError {
  constructor(public providerStatus: number) { super("Mercado Pago no pudo responder. Verificaremos el intento sin repetir el cobro.", 502); }
}
async function mp<T>(path: string, body?: object, method = "POST"): Promise<T> {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method: body ? method : "GET", cache: "no-store", signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${checkoutSecret("MERCADOPAGO_TEST_ACCESS_TOKEN")}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new ProviderError(response.status);
  return response.json() as Promise<T>;
}
async function verifySeller() {
  const seller = await mp<{ id: number; site_id: string; tags: string[] }>("/users/me");
  if (String(seller.id) !== testSellerId || seller.site_id !== "MLC" || !seller.tags?.includes("test_user")) {
    throw new CheckoutError("El modo de prueba solo admite el vendedor ficticio de TOCA.", 403);
  }
}
const reference = (session: CheckoutSession) => `TOCA-TEST-${session.id}`;
function verifySubscription(subscription: Subscription, session: CheckoutSession) {
  const plan = plans[session.plan];
  if (subscription.external_reference !== reference(session) || String(subscription.collector_id) !== testSellerId ||
      subscription.auto_recurring.transaction_amount !== plan.total || subscription.auto_recurring.currency_id !== "CLP" ||
      subscription.auto_recurring.frequency !== plan.months || subscription.auto_recurring.frequency_type !== "months") {
    throw new CheckoutError("La suscripción no coincide con el plan comprado.", 403);
  }
}
function checkoutUrl(subscription: Subscription) {
  const url = new URL(subscription.init_point);
  if (url.origin !== "https://www.mercadopago.cl" || url.pathname !== "/subscriptions/checkout" ||
      url.searchParams.get("preapproval_id") !== subscription.id || url.username || url.password) {
    throw new CheckoutError("La dirección de checkout recibida no es válida.", 502);
  }
  return url.href;
}
async function findSubscription(session: CheckoutSession, id: string | null) {
  if (!id) {
    const search = await mp<{ results: Subscription[] }>(`/preapproval/search?external_reference=${reference(session)}`);
    const found = search.results.filter(item => item.external_reference === reference(session));
    if (found.length > 1) throw new CheckoutError("Hay más de una suscripción para este intento. No vuelvas a pagar; revisa el intento con el administrador.", 409);
    id = found[0]?.id;
  }
  if (!id) return null;
  const subscription = await mp<Subscription>(`/preapproval/${encodeURIComponent(id)}`);
  verifySubscription(subscription, session);
  return subscription;
}
export async function startCheckout(session: CheckoutSession) {
  await verifySeller();
  if (!await claimAttempt(session)) return;
  let created: Subscription;
  try {
    const plan = plans[session.plan];
    created = await mp<Subscription>("/preapproval", {
      reason: `TOCA - ${plan.name} por NFC (IVA incluido) - Prueba`,
      external_reference: reference(session), payer_email: testBuyerEmail, status: "pending",
      auto_recurring: { frequency: plan.months, frequency_type: "months", transaction_amount: plan.total, currency_id: "CLP" },
      back_url: `${session.origin}/comprar/resultado`,
    });
  } catch (error) {
    if (error instanceof ProviderError && error.providerStatus === 400) {
      await saveAttempt(session, { state: "failed" });
      throw new CheckoutError("Mercado Pago rechazó la creación de la suscripción de prueba.");
    }
    // Un timeout puede ocurrir después de crear la suscripción: solo reconciliar, nunca repetir el POST.
    throw error;
  }
  verifySubscription(created, session);
  await saveAttempt(session, { subscription_id: created.id, state: "ready" });
}
export async function checkoutStatus(session: CheckoutSession): Promise<CheckoutStatus> {
  const attempt = await getAttempt(session);
  const base = { plan: session.plan, reference: reference(session) };
  if (!attempt) return { ...base, state: "empty" as const };
  if (attempt.state === "failed") return { ...base, state: "failed" as const };
  const subscription = await findSubscription(session, attempt.subscription_id);
  if (!subscription) return { ...base, state: "creating" as const };
  const state = subscription.status === "cancelled" ? "cancelled" as const : "ready" as const;
  if (attempt.subscription_id !== subscription.id || attempt.state !== state) {
    await saveAttempt(session, { subscription_id: subscription.id, state });
  }
  const invoices = await mp<{ results: { payment?: { id: number } }[] }>(`/authorized_payments/search?preapproval_id=${subscription.id}`);
  const paymentId = invoices.results.find(item => item.payment?.id)?.payment?.id;
  const payment = paymentId ? await mp<Payment>(`/v1/payments/${paymentId}`) : null;
  if (payment && (payment.external_reference !== reference(session) || String(payment.collector_id) !== testSellerId ||
      payment.transaction_amount !== plans[session.plan].total || payment.currency_id !== "CLP" || payment.payer?.email !== testBuyerEmail)) {
    throw new CheckoutError("El pago no coincide con esta compra de prueba.", 403);
  }
  return { ...base, state, subscriptionId: subscription.id, subscriptionStatus: subscription.status,
    checkoutUrl: subscription.status === "pending" ? checkoutUrl(subscription) : undefined,
    paymentId: payment?.id, paymentStatus: payment?.status ?? "pending", paymentDetail: payment?.status_detail };
}
export type CheckoutStatus = {
  state: "empty" | "creating" | "ready" | "failed" | "cancelled";
  plan?: CheckoutSession["plan"]; reference?: string; subscriptionId?: string; subscriptionStatus?: string;
  checkoutUrl?: string; paymentId?: number; paymentStatus?: string; paymentDetail?: string;
};
export async function cancelCheckout(session: CheckoutSession) {
  await verifySeller();
  const attempt = await getAttempt(session);
  if (!attempt || attempt.state === "failed") return;
  const subscription = await findSubscription(session, attempt.subscription_id);
  if (!subscription) throw new CheckoutError("Todavía verificamos la creación. Espera el resultado antes de iniciar otra compra.", 409);
  if (subscription.status !== "cancelled") await mp(`/preapproval/${subscription.id}`, { status: "cancelled" }, "PUT");
  await saveAttempt(session, { subscription_id: subscription.id, state: "cancelled" });
}
