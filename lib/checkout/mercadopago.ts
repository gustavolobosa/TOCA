import "server-only";
import { plans } from "@/lib/pricing";
import { CheckoutError, checkoutSecret, testBuyerEmail, testSellerId } from "./config";
import type { CheckoutPurchase } from "./session";
import { claimAttempt, getAttempt, saveAttempt, findAttempt, purchaseFromAttempt, fulfillPurchase } from "./store";

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
const reference = (session: CheckoutPurchase) => `TOCA-TEST-${session.id}`;
function verifySubscription(subscription: Subscription, session: CheckoutPurchase) {
  const plan = plans[session.plan];
  if (subscription.external_reference !== reference(session) || String(subscription.collector_id) !== testSellerId ||
      subscription.auto_recurring.transaction_amount !== session.totalAmount || subscription.auto_recurring.currency_id !== "CLP" ||
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
async function findSubscription(session: CheckoutPurchase, id: string | null) {
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
export async function startCheckout(session: CheckoutPurchase) {
  await verifySeller();
  if (!await claimAttempt(session)) return;
  let created: Subscription;
  try {
    const plan = plans[session.plan];
    created = await mp<Subscription>("/preapproval", {
      reason: `TOCA - ${plan.name} - ${session.quantity} NFC (IVA incluido) - Prueba`,
      external_reference: reference(session), payer_email: testBuyerEmail, status: "pending",
      auto_recurring: { frequency: plan.months, frequency_type: "months", transaction_amount: session.totalAmount, currency_id: "CLP" },
      back_url: `${session.origin}/comprar/resultado/${session.id}`,
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
export async function checkoutStatus(session: CheckoutPurchase, notifiedPaymentId?: number): Promise<CheckoutStatus> {
  const attempt = await getAttempt(session);
  const base = { purchaseId: session.id, plan: session.plan, quantity: session.quantity, totalAmount: session.totalAmount, reference: reference(session) };
  if (!attempt) return { ...base, state: "empty" as const };
  if (attempt.state === "failed") return { ...base, state: "failed" as const };
  const subscription = await findSubscription(session, attempt.subscription_id);
  if (!subscription) return { ...base, state: "creating" as const };
  const state = subscription.status === "cancelled" ? "cancelled" as const : "ready" as const;
  if (attempt.subscription_id !== subscription.id || attempt.state !== state) {
    await saveAttempt(session, { subscription_id: subscription.id, state });
  }
  const invoices = await mp<{ results: { payment?: { id: number; status?: string } }[] }>(`/authorized_payments/search?preapproval_id=${subscription.id}`);
  if (!attempt.fulfilled_at && notifiedPaymentId && !invoices.results.some(item => item.payment?.id === notifiedPaymentId)) {
    throw new CheckoutError("El pago todavía no aparece asociado a la suscripción. Reintentaremos la verificación.", 503);
  }
  const candidate = invoices.results.find(item => item.payment?.status === "approved") ?? invoices.results.find(item => item.payment?.id);
  const paymentId = notifiedPaymentId ?? (attempt.payment_id ? Number(attempt.payment_id) : candidate?.payment?.id);
  const payment = paymentId ? await mp<Payment>(`/v1/payments/${paymentId}`) : null;
  if (payment && (payment.external_reference !== reference(session) || String(payment.collector_id) !== testSellerId ||
      payment.transaction_amount !== session.totalAmount || payment.currency_id !== "CLP" || payment.payer?.email !== testBuyerEmail)) {
    throw new CheckoutError("El pago no coincide con esta compra de prueba.", 403);
  }
  if (payment?.status === "approved") await fulfillPurchase(session, subscription.id, payment.id);
  return { ...base, state, fulfilled: Boolean(attempt.fulfilled_at) || payment?.status === "approved", subscriptionId: subscription.id, subscriptionStatus: subscription.status,
    checkoutUrl: subscription.status === "pending" ? checkoutUrl(subscription) : undefined,
    paymentId: payment?.id, paymentStatus: payment?.status ?? "pending", paymentDetail: payment?.status_detail };
}
export type CheckoutStatus = {
  state: "empty" | "creating" | "ready" | "failed" | "cancelled";
  purchaseId?: string; fulfilled?: boolean; totalAmount?: number;
  plan?: CheckoutPurchase["plan"]; quantity?: number; reference?: string; subscriptionId?: string; subscriptionStatus?: string;
  checkoutUrl?: string; paymentId?: number; paymentStatus?: string; paymentDetail?: string;
};
export async function cancelCheckout(session: CheckoutPurchase) {
  await verifySeller();
  const attempt = await getAttempt(session);
  if (!attempt || attempt.state === "failed") return;
  const subscription = await findSubscription(session, attempt.subscription_id);
  if (!subscription) throw new CheckoutError("Todavía verificamos la creación. Espera el resultado antes de iniciar otra compra.", 409);
  if (subscription.status !== "cancelled") await mp(`/preapproval/${subscription.id}`, { status: "cancelled" }, "PUT");
  await saveAttempt(session, { subscription_id: subscription.id, state: "cancelled" });
}

// La notificación solo da una pista. La identidad, el importe y el estado se leen de la API.
export async function reconcileNotification(topic: string, id: string) {
  let subscriptionId: string | undefined;
  let payment: Payment | undefined;
  if (topic === "subscription_preapproval") subscriptionId = id;
  else if (topic === "subscription_authorized_payment") {
    const invoice = await mp<{ preapproval_id: string; payment?: { id: number } }>(`/authorized_payments/${encodeURIComponent(id)}`);
    subscriptionId = invoice.preapproval_id;
    if (invoice.payment?.id) payment = await mp<Payment>(`/v1/payments/${invoice.payment.id}`);
  } else if (topic === "payment") payment = await mp<Payment>(`/v1/payments/${encodeURIComponent(id)}`);
  else return;
  const subscription = subscriptionId ? await mp<Subscription>(`/preapproval/${encodeURIComponent(subscriptionId)}`) : null;
  const externalReference = subscription?.external_reference ?? payment?.external_reference;
  const match = /^TOCA-TEST-([a-f0-9-]{36})$/.exec(externalReference ?? "");
  if (!match) return;
  const attempt = await findAttempt(match[1]);
  if (!attempt?.user_id) return;
  const purchase = purchaseFromAttempt(attempt);
  if (subscription) {
    verifySubscription(subscription, purchase);
    if (attempt.subscription_id && attempt.subscription_id !== subscription.id) throw new CheckoutError("Suscripción inconsistente.", 403);
  }
  if (payment && (String(payment.collector_id) !== testSellerId || payment.external_reference !== reference(purchase))) throw new CheckoutError("Pago inconsistente.", 403);
  await checkoutStatus(purchase, payment?.id);
}
