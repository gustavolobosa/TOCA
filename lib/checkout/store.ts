import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isPlan, isNfcQuantity } from "@/lib/pricing";
import { CheckoutError, testBuyerEmail, type CheckoutMode } from "./config";
import type { CheckoutPurchase } from "./session";
import { promotionError } from "./promotions";

export type Attempt = {
  id: string; plan: string; quantity: number; user_id: string | null; origin: string | null;
  total_amount: number | null; payment_id: string | null; fulfilled_at: string | null;
  subscription_id: string | null; state: "creating" | "ready" | "failed" | "cancelled"; created_at: string;
  mode: CheckoutMode; buyer_email: string | null; paid_until: string | null; billing_blocked: boolean;
  promo_id: string | null; promo_code: string | null; unit_net: number | null;
  promo_state: "reserved" | "consumed" | "released" | null; promo_expires_at: string | null; promo_cancelled_at: string | null;
};
const columns = "id,plan,quantity,user_id,origin,total_amount,payment_id,fulfilled_at,subscription_id,state,created_at,mode,buyer_email,paid_until,billing_blocked,promo_id,promo_code,unit_net,promo_state,promo_expires_at,promo_cancelled_at";
const storageError = () => new CheckoutError("No se pudo acceder a tus compras. Revisa las variables y la migración de Supabase.", 503);
function db() {
  try { return createSupabaseServiceClient(); } catch { throw storageError(); }
}
export function purchaseFromAttempt(attempt: Attempt): CheckoutPurchase {
  if (!attempt.user_id || !attempt.origin || !isPlan(attempt.plan) || !isNfcQuantity(attempt.quantity) || !Number.isSafeInteger(attempt.total_amount) || attempt.total_amount! < 1) {
    throw new CheckoutError("Esta compra no tiene un usuario asociado. Las pruebas anteriores se conservan sin asignar NFC.", 409);
  }
  if ((attempt.mode !== "test" && attempt.mode !== "production") || (attempt.mode === "production" && !attempt.buyer_email)) throw storageError();
  return { id: attempt.id, plan: attempt.plan, quantity: attempt.quantity, userId: attempt.user_id, origin: attempt.origin, totalAmount: attempt.total_amount!, mode: attempt.mode, buyerEmail: attempt.buyer_email ?? testBuyerEmail,
    unitNet: attempt.unit_net ?? undefined, promoId: attempt.promo_id ?? undefined, promoCode: attempt.promo_code ?? undefined };
}
export async function findAttempt(id: string, userId?: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new CheckoutError("Compra inválida.", 400);
  let query = db().from("checkout_test_attempts").select(columns).eq("id", id);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw storageError();
  return data as Attempt | null;
}
export async function getAttempt(purchase: CheckoutPurchase) {
  const data = await findAttempt(purchase.id, purchase.userId);
  if (data && (data.mode !== purchase.mode || data.plan !== purchase.plan || data.quantity !== purchase.quantity || data.total_amount !== purchase.totalAmount ||
    (data.promo_id ?? undefined) !== purchase.promoId || (data.promo_code ?? undefined) !== purchase.promoCode)) throw new CheckoutError("La compra no corresponde a esta sesión.", 403);
  return data;
}
export async function listAttempts(userId: string) {
  const { data, error } = await db().from("checkout_test_attempts").select(columns).eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  if (error) throw storageError();
  return data as Attempt[];
}
export async function claimAttempt(purchase: CheckoutPurchase) {
  if (await getAttempt(purchase)) return false;
  const { error } = await db().from("checkout_test_attempts").insert({ id: purchase.id, plan: purchase.plan, quantity: purchase.quantity,
    user_id: purchase.userId, origin: purchase.origin, total_amount: purchase.totalAmount, mode: purchase.mode, buyer_email: purchase.buyerEmail,
    promo_id: purchase.promoId ?? null, promo_code: purchase.promoCode ?? null, unit_net: purchase.unitNet ?? null });
  if (error?.code === "23505") {
    if (await getAttempt(purchase)) return false;
    promotionError("promo_used");
  }
  if (error && purchase.promoId) promotionError(error.message);
  if (error) throw storageError();
  return true;
}
export async function saveAttempt(purchase: CheckoutPurchase, values: Pick<Attempt, "state"> & Partial<Pick<Attempt, "subscription_id">>) {
  const { data, error } = await db().from("checkout_test_attempts").update(values).eq("id", purchase.id).eq("user_id", purchase.userId)
    .eq("plan", purchase.plan).eq("quantity", purchase.quantity).select("id").single();
  if (error || !data) throw storageError();
}
export async function fulfillPurchase(purchase: CheckoutPurchase, subscriptionId: string, paymentId: number) {
  if (purchase.mode !== "test") throw new CheckoutError("Compra de prueba requerida.", 403);
  const { data, error } = await db().rpc("fulfill_checkout_test_purchase", {
    purchase_id: purchase.id, provider_subscription: subscriptionId, provider_payment: String(paymentId),
    paid_amount: purchase.totalAmount, paid_currency: "CLP",
  });
  if (error || data !== purchase.quantity) throw new CheckoutError("El pago está aprobado, pero todavía no pudimos asignar tus NFC. Reintentaremos sin cobrar otra vez.", 503);
}

export async function recordPayment(purchase: CheckoutPurchase, subscriptionId: string, payment: {
  id: number; status: string; transaction_amount_refunded?: number; date_last_updated: string;
}, invoice: { id: number; debit_date: string }) {
  const { data, error } = await db().rpc("reconcile_checkout_payment", {
    purchase_id: purchase.id, provider_subscription: subscriptionId, provider_payment: String(payment.id),
    provider_invoice: String(invoice.id), paid_amount: purchase.totalAmount, paid_currency: "CLP",
    payment_status: payment.status, refunded_amount: payment.transaction_amount_refunded ?? 0,
    provider_updated: payment.date_last_updated, cycle_start: invoice.debit_date,
  });
  if (error || data !== purchase.quantity) throw new CheckoutError("Estamos verificando la vigencia de tus NFC. Reintentaremos sin volver a cobrar.", 503);
}

export async function reconciliationBatch() {
  const { data, error } = await db().from("checkout_test_attempts").select(columns).eq("mode", "production")
    .neq("state", "failed").not("user_id", "is", null).order("last_reconciled_at", { ascending: true, nullsFirst: true }).limit(20);
  if (error) throw storageError();
  return data as Attempt[];
}
export async function markReconciliation(id: string) {
  const { error } = await db().from("checkout_test_attempts").update({ last_reconciled_at: new Date().toISOString() }).eq("id", id);
  if (error) throw storageError();
}

export async function promotionCleanupBatch() {
  const { data, error } = await db().from("checkout_test_attempts").select(columns).eq("promo_state", "reserved")
    .lt("promo_expires_at", new Date().toISOString()).order("last_reconciled_at", { ascending: true, nullsFirst: true }).limit(10);
  if (error) throw storageError();
  return data as Attempt[];
}
export async function releasePromotion(purchaseId: string) {
  const { error } = await db().rpc("release_checkout_promotion", { purchase_id: purchaseId });
  if (error) throw storageError();
}

export async function consumeTestPromotion(purchase: CheckoutPurchase) {
  if (purchase.mode !== "test" || !purchase.promoId) return;
  const { error } = await db().from("checkout_test_attempts").update({ promo_state: "consumed" })
    .eq("id", purchase.id).eq("user_id", purchase.userId).eq("mode", "test").eq("promo_id", purchase.promoId);
  if (error) throw storageError();
}
