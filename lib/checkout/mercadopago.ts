import "server-only";
import { plans } from "@/lib/pricing";
import { CheckoutError, checkoutMode, checkoutSecret, sellerId, testBuyerEmail, webhookSecret, type CheckoutMode } from "./config";
import type { CheckoutPurchase } from "./session";
import { claimAttempt, getAttempt, saveAttempt, findAttempt, purchaseFromAttempt, fulfillPurchase, recordPayment, releasePromotion, consumeTestPromotion } from "./store";

type Subscription = {
  id: string; status: string; external_reference: string; collector_id: number; init_point: string;
  auto_recurring: { transaction_amount: number; currency_id: string; frequency: number; frequency_type: string };
};
type Payment = {
  id: number; status: string; status_detail: string; transaction_amount: number; currency_id: string;
  external_reference: string; collector_id: number; live_mode?: boolean; payer?: { email?: string };
  transaction_amount_refunded?: number; date_last_updated: string;
};
type Invoice = { id: number; preapproval_id: string; debit_date: string; status?: string; payment?: { id: number; status?: string } };
class ProviderError extends CheckoutError {
  constructor(public providerStatus: number) { super("Mercado Pago no pudo responder. Verificaremos el intento sin repetir el cobro.", 502); }
}
function client(mode: CheckoutMode) {
  const deadline = AbortSignal.timeout(45000);
  return async function mp<T>(path: string, body?: object, method = "POST"): Promise<T> {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      method: body ? method : "GET", cache: "no-store", signal: AbortSignal.any([deadline, AbortSignal.timeout(8000)]),
      headers: { Authorization: `Bearer ${checkoutSecret(mode === "test" ? "MERCADOPAGO_TEST_ACCESS_TOKEN" : "MERCADOPAGO_ACCESS_TOKEN")}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new ProviderError(response.status);
    return response.json() as Promise<T>;
  };
}
type Client = ReturnType<typeof client>;
async function verifySeller(mode: CheckoutMode, mp: Client) {
  const seller = await mp<{ id: number; site_id: string; tags: string[] }>("/users/me");
  if (String(seller.id) !== sellerId(mode) || seller.site_id !== "MLC" || !Array.isArray(seller.tags) ||
      seller.tags.includes("test_user") !== (mode === "test")) {
    throw new CheckoutError("Las credenciales de Mercado Pago no corresponden al vendedor y modo configurados.", 503);
  }
}
const reference = (purchase: CheckoutPurchase) => `TOCA-${purchase.mode === "test" ? "TEST" : "LIVE"}-${purchase.id}`;
function verifySubscription(subscription: Subscription, purchase: CheckoutPurchase) {
  const plan = plans[purchase.plan];
  if (subscription.external_reference !== reference(purchase) || String(subscription.collector_id) !== sellerId(purchase.mode) ||
      subscription.auto_recurring?.transaction_amount !== purchase.totalAmount || subscription.auto_recurring.currency_id !== "CLP" ||
      subscription.auto_recurring.frequency !== plan.months || subscription.auto_recurring.frequency_type !== "months") {
    throw new CheckoutError("La suscripción no coincide con el plan comprado.", 403);
  }
}
function verifyPayment(payment: Payment, purchase: CheckoutPurchase) {
  if (!Number.isSafeInteger(payment.id) || payment.id < 1 || payment.external_reference !== reference(purchase) ||
      String(payment.collector_id) !== sellerId(purchase.mode) || payment.transaction_amount !== purchase.totalAmount || payment.currency_id !== "CLP" ||
      (purchase.mode === "production" ? payment.live_mode !== true || !Number.isFinite(payment.transaction_amount_refunded) ||
        !Number.isFinite(Date.parse(payment.date_last_updated)) : payment.payer?.email !== testBuyerEmail)) {
    throw new CheckoutError("El pago no coincide con esta compra.", 403);
  }
  // El correo de la billetera puede diferir del de TOCA. El propietario es el usuario autenticado que creó la compra.
}
function checkoutUrl(subscription: Subscription) {
  const url = new URL(subscription.init_point);
  if (url.origin !== "https://www.mercadopago.cl" || url.pathname !== "/subscriptions/checkout" ||
      url.searchParams.get("preapproval_id") !== subscription.id || url.username || url.password) {
    throw new CheckoutError("La dirección de checkout recibida no es válida.", 502);
  }
  return url.href;
}
async function findSubscription(purchase: CheckoutPurchase, id: string | null, mp: Client) {
  if (!id) {
    const search = await mp<{ results: Subscription[] }>(`/preapproval/search?external_reference=${reference(purchase)}`);
    const found = search.results.filter(item => item.external_reference === reference(purchase));
    if (found.length > 1) throw new CheckoutError("Hay más de una suscripción para este intento. No vuelvas a pagar; revisa el intento con el administrador.", 409);
    id = found[0]?.id;
  }
  if (!id) return null;
  const subscription = await mp<Subscription>(`/preapproval/${encodeURIComponent(id)}`);
  verifySubscription(subscription, purchase);
  return subscription;
}
export async function startCheckout(purchase: CheckoutPurchase) {
  if (purchase.mode !== checkoutMode()) throw new CheckoutError("El modo de compra cambió. Vuelve a seleccionar tu plan.", 409);
  const mp = client(purchase.mode);
  // Una configuración incompleta falla antes de crear una suscripción cobrable.
  webhookSecret(purchase.mode);
  await verifySeller(purchase.mode, mp);
  if (!await claimAttempt(purchase)) return;
  let created: Subscription;
  try {
    const plan = plans[purchase.plan];
    created = await mp<Subscription>("/preapproval", {
      reason: `TOCA - ${plan.name} - ${purchase.quantity} NFC (IVA incluido)${purchase.mode === "test" ? " - Prueba" : ""}`,
      external_reference: reference(purchase), payer_email: purchase.mode === "test" ? testBuyerEmail : purchase.buyerEmail, status: "pending",
      auto_recurring: { frequency: plan.months, frequency_type: "months", transaction_amount: purchase.totalAmount, currency_id: "CLP" },
      back_url: `${purchase.origin}/comprar/resultado/${purchase.id}`,
    });
  } catch (error) {
    if (error instanceof ProviderError && error.providerStatus === 400) {
      await saveAttempt(purchase, { state: "failed" });
      throw new CheckoutError("Mercado Pago rechazó la creación de la suscripción.");
    }
    // Un timeout puede ocurrir después de crear la suscripción: solo reconciliar, nunca repetir el POST.
    throw error;
  }
  verifySubscription(created, purchase);
  await saveAttempt(purchase, { subscription_id: created.id, state: "ready" });
}
async function invoicesFor(subscriptionId: string, mp: Client, paymentId?: number) {
  const invoices: Invoice[] = [];
  const pageSize = 10;
  for (let offset = 0; offset < 1000; offset += pageSize) {
    const search = await mp<{ results: Invoice[]; paging?: { total: number } }>(
      `/authorized_payments/search?preapproval_id=${encodeURIComponent(subscriptionId)}&limit=${pageSize}&offset=${offset}${paymentId ? `&payment_id=${paymentId}` : ""}`);
    invoices.push(...search.results);
    if (search.results.length < pageSize || (search.paging && offset + search.results.length >= search.paging.total)) return invoices;
  }
  throw new CheckoutError("La suscripción requiere una revisión de su historial de pagos.", 503);
}
export async function checkoutStatus(purchase: CheckoutPurchase, notifiedPaymentId?: number, provider?: Client): Promise<CheckoutStatus> {
  const attempt = await getAttempt(purchase);
  const base = { purchaseId: purchase.id, mode: purchase.mode, plan: purchase.plan, quantity: purchase.quantity, totalAmount: purchase.totalAmount,
    unitNet: purchase.unitNet, promoCode: purchase.promoCode, promoState: attempt?.promo_state ?? undefined, reference: reference(purchase) };
  if (!attempt) return { ...base, state: "empty" };
  if (attempt.state === "failed") return { ...base, state: "failed" };
  const mp = provider ?? client(purchase.mode);
  await verifySeller(purchase.mode, mp);
  const subscription = await findSubscription(purchase, attempt.subscription_id, mp);
  if (!subscription) return { ...base, state: "creating" };
  const state = ["cancelled", "canceled"].includes(subscription.status) ? "cancelled" : "ready";
  if (attempt.subscription_id !== subscription.id || attempt.state !== state) await saveAttempt(purchase, { subscription_id: subscription.id, state });
  const invoices = await invoicesFor(subscription.id, mp, notifiedPaymentId);
  const ordered = invoices.filter(item => item.payment?.id).sort((a, b) => Date.parse(b.debit_date) - Date.parse(a.debit_date));
  const selected = notifiedPaymentId ? [ordered.find(item => item.payment?.id === notifiedPaymentId)] : purchase.promoId && attempt.promo_state === "reserved" ? ordered :
    [ordered[0], ordered.find(item => item.payment?.status === "approved")];
  if (notifiedPaymentId && !selected[0]) throw new CheckoutError("El pago todavía no aparece asociado a la suscripción. Reintentaremos la verificación.", 503);
  let latest: Payment | undefined;
  const processed = new Set<number>();
  for (const invoice of selected) {
    if (!invoice?.payment?.id || processed.has(invoice.payment.id)) continue;
    processed.add(invoice.payment.id);
    // Comprobar también la pertenencia en el recurso individual; no confiar solo en el filtro de búsqueda.
    const verifiedInvoice = await mp<Invoice>(`/authorized_payments/${invoice.id}`);
    if (verifiedInvoice.preapproval_id !== subscription.id || verifiedInvoice.payment?.id !== invoice.payment.id) throw new CheckoutError("El pago no pertenece a esta suscripción.", 403);
    const payment = await mp<Payment>(`/v1/payments/${invoice.payment.id}`);
    verifyPayment(payment, purchase);
    latest ??= payment;
    if (purchase.mode === "production") await recordPayment(purchase, subscription.id, payment, verifiedInvoice);
    else {
      if (["approved", "refunded", "charged_back"].includes(payment.status) || (payment.transaction_amount_refunded ?? 0) > 0) await consumeTestPromotion(purchase);
      if (payment.status === "approved") await fulfillPurchase(purchase, subscription.id, payment.id);
    }
  }
  const updated = await getAttempt(purchase);
  return { ...base, state, promoState: updated?.promo_state ?? undefined, fulfilled: Boolean(updated?.fulfilled_at), paidUntil: updated?.paid_until ?? undefined, billingBlocked: updated?.billing_blocked,
    subscriptionId: subscription.id, subscriptionStatus: subscription.status,
    checkoutUrl: subscription.status === "pending" && purchase.mode === checkoutMode() ? checkoutUrl(subscription) : undefined,
    paymentId: latest?.id, paymentStatus: latest?.status ?? "pending", paymentDetail: latest?.status_detail };
}
export type CheckoutStatus = {
  state: "empty" | "creating" | "ready" | "failed" | "cancelled";
  purchaseId?: string; fulfilled?: boolean; totalAmount?: number; mode?: CheckoutMode; paidUntil?: string; billingBlocked?: boolean;
  plan?: CheckoutPurchase["plan"]; quantity?: number; reference?: string; subscriptionId?: string; subscriptionStatus?: string;
  checkoutUrl?: string; paymentId?: number; paymentStatus?: string; paymentDetail?: string;
  unitNet?: number; promoCode?: string; promoState?: "reserved" | "consumed" | "released";
};
export async function cancelCheckout(purchase: CheckoutPurchase) {
  const mp = client(purchase.mode);
  await verifySeller(purchase.mode, mp);
  const attempt = await getAttempt(purchase);
  if (!attempt || attempt.state === "failed") return;
  const subscription = await findSubscription(purchase, attempt.subscription_id, mp);
  if (!subscription) throw new CheckoutError("Todavía verificamos la creación. Espera el resultado antes de iniciar otra compra.", 409);
  if (!["cancelled", "canceled"].includes(subscription.status)) await mp(`/preapproval/${subscription.id}`, { status: "cancelled" }, "PUT");
  await saveAttempt(purchase, { subscription_id: subscription.id, state: "cancelled" });
}

// No liberar por tiempo solamente: un checkout externo puede seguir siendo cobrable.
export async function cleanupPromotion(purchase: CheckoutPurchase) {
  const mp = client(purchase.mode);
  await checkoutStatus(purchase, undefined, mp);
  let attempt = await getAttempt(purchase);
  if (!attempt || attempt.promo_state !== "reserved" || !attempt.promo_expires_at || Date.parse(attempt.promo_expires_at) > Date.now()) return;
  let subscription = await findSubscription(purchase, attempt.subscription_id, mp);
  // Una creación de resultado incierto se mantiene reservada; nunca repetir el POST.
  if (!subscription) return;
  if (subscription.status === "pending") {
    await mp(`/preapproval/${subscription.id}`, { status: "cancelled" }, "PUT");
    subscription = await findSubscription(purchase, subscription.id, mp);
  }
  if (!subscription || !["cancelled", "canceled"].includes(subscription.status)) return;
  await saveAttempt(purchase, { subscription_id: subscription.id, state: "cancelled" });
  attempt = await getAttempt(purchase);
  if (!attempt?.promo_cancelled_at || Date.parse(attempt.promo_cancelled_at) > Date.now() - 86400000) return;
  // Reconciliar otra vez después de confirmar la cancelación y esperar la ventana de seguridad.
  await checkoutStatus(purchase, undefined, mp);
  const invoices = await invoicesFor(subscription.id, mp);
  for (const item of invoices) {
    const invoice = await mp<Invoice>(`/authorized_payments/${item.id}`);
    if (invoice.preapproval_id !== subscription.id) throw new CheckoutError("Factura inconsistente.", 403);
    if (!invoice.payment?.id) {
      if (!["cancelled", "canceled"].includes(invoice.status ?? "")) return;
    } else {
      const payment = await mp<Payment>(`/v1/payments/${invoice.payment.id}`);
      verifyPayment(payment, purchase);
      if (!["rejected", "cancelled"].includes(payment.status)) return;
    }
  }
  // Un pago puede aparecer en la búsqueda antes de asociarse a una factura.
  for (let offset = 0; offset < 1000; offset += 10) {
    const search = await mp<{ results: Payment[]; paging: { total: number } }>(
      `/v1/payments/search?external_reference=${encodeURIComponent(reference(purchase))}&limit=10&offset=${offset}`);
    if (!Array.isArray(search.results) || !Number.isSafeInteger(search.paging?.total)) throw new CheckoutError("Historial de pagos incompleto.", 503);
    for (const item of search.results) {
      const payment = await mp<Payment>(`/v1/payments/${item.id}`);
      verifyPayment(payment, purchase);
      if (!["rejected", "cancelled"].includes(payment.status)) return;
    }
    if (offset + search.results.length >= search.paging.total) {
      await releasePromotion(purchase.id);
      return;
    }
    if (!search.results.length) break;
  }
  throw new CheckoutError("No pudimos verificar todo el historial para liberar el código.", 503);
}

// La notificación solo da una pista. La identidad, el importe y el estado se leen de la API.
export async function reconcileNotification(topic: string, id: string, mode: CheckoutMode) {
  const mp = client(mode);
  let subscriptionId: string | undefined;
  let payment: Payment | undefined;
  if (topic === "subscription_preapproval") subscriptionId = id;
  else if (topic === "subscription_authorized_payment") {
    const invoice = await mp<Invoice>(`/authorized_payments/${encodeURIComponent(id)}`);
    subscriptionId = invoice.preapproval_id;
    if (invoice.payment?.id) payment = await mp<Payment>(`/v1/payments/${invoice.payment.id}`);
  } else if (topic === "payment") payment = await mp<Payment>(`/v1/payments/${encodeURIComponent(id)}`);
  else return;
  const subscription = subscriptionId ? await mp<Subscription>(`/preapproval/${encodeURIComponent(subscriptionId)}`) : null;
  const match = /^TOCA-(TEST|LIVE)-([a-f0-9-]{36})$/.exec(subscription?.external_reference ?? payment?.external_reference ?? "");
  if (!match) return;
  const attempt = await findAttempt(match[2]);
  if (!attempt?.user_id) return;
  const purchase = purchaseFromAttempt(attempt);
  if (purchase.mode !== mode || (match[1] === "TEST") !== (mode === "test")) throw new CheckoutError("Modo de pago inconsistente.", 403);
  if (subscription) {
    verifySubscription(subscription, purchase);
    if (attempt.subscription_id && attempt.subscription_id !== subscription.id) throw new CheckoutError("Suscripción inconsistente.", 403);
  }
  if (payment) verifyPayment(payment, purchase);
  await checkoutStatus(purchase, payment?.id, mp);
}
