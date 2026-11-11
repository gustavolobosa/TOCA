import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isPlan } from "@/lib/pricing";
import { CheckoutError } from "./config";
import type { Attempt } from "./store";
import type { BillingPurchase, BillingPayment } from "@/lib/billing";

export function billingPurchase(attempt: Attempt): BillingPurchase {
  if (!isPlan(attempt.plan) || !attempt.user_id || !Number.isSafeInteger(attempt.total_amount)) throw new CheckoutError("No pudimos leer esta suscripción.", 503);
  return { id: attempt.id, plan: attempt.plan, quantity: attempt.quantity, totalAmount: attempt.total_amount!,
    renewalStatus: attempt.renewal_status, nextPaymentDate: attempt.next_payment_at,
    unitNet: attempt.unit_net, promoCode: attempt.promo_code, mode: attempt.mode, state: attempt.state,
    hasSubscription: Boolean(attempt.subscription_id), fulfilled: Boolean(attempt.fulfilled_at), paidUntil: attempt.paid_until,
    blocked: attempt.billing_blocked, createdAt: attempt.created_at };
}
export async function billingPurchases(userId: string, page: number, archived: boolean) {
  const now = Date.now();
  const timestamp = new Date(now).toISOString();
  const past = `state.eq.failed,and(state.eq.cancelled,or(paid_until.is.null,paid_until.lte.${timestamp},billing_blocked.eq.true))`;
  const current = `state.in.(creating,ready),and(state.eq.cancelled,paid_until.gt.${timestamp},billing_blocked.eq.false)`;
  const db = createSupabaseServiceClient();
  const query = db.from("checkout_test_attempts")
    .select("id,plan,quantity,total_amount,renewal_status,next_payment_at,unit_net,promo_code,mode,state,subscription_id,fulfilled_at,paid_until,billing_blocked,created_at,user_id", { count: "exact" })
    .eq("user_id", userId).or(archived ? past : current).order("paid_until", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).order("id").range(page * 10, page * 10 + 9);
  const [{ data, error, count }, prior] = await Promise.all([query, archived ? null :
    db.from("checkout_test_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId).or(past)]);
  if (error || prior?.error) throw new CheckoutError("No pudimos cargar tus suscripciones. Intenta nuevamente.", 503);
  return { purchases: (data as Attempt[]).map(billingPurchase), count: count ?? 0, archivedCount: prior?.count ?? 0, now };
}
// Llamar solo después de verificar la propiedad con findAttempt(id, user.id).
export async function billingPayments(attempt: Attempt, page: number) {
  if (attempt.mode === "test") return { payments: [], paymentCount: 0, paymentPage: page };
  const { data, error, count } = await createSupabaseServiceClient().from("checkout_payments")
    .select("payment_id,status,refunded_amount,period_start,period_end,approved_at,payment_method", { count: "exact" })
    .eq("purchase_id", attempt.id).order("period_start", { ascending: false }).order("payment_id").range(page * 10, page * 10 + 9);
  if (error) throw new CheckoutError("No pudimos consultar el historial de pagos.", 503);
  return { payments: data as BillingPayment[], paymentCount: count ?? 0, paymentPage: page };
}

export async function billingOverview(userId: string) {
  const { data, error } = await createSupabaseServiceClient().rpc("billing_overview", { owner: userId }).single();
  if (error || !data) throw new CheckoutError("No pudimos consultar el resumen de tus suscripciones.", 503);
  return data as { nfc_count: number; subscription_count: number; next_at: string | null; next_amount: number | null; uncertain: boolean };
}
export async function accountPayments(userId: string, page: number, purchaseId?: string) {
  let query = createSupabaseServiceClient().from("checkout_payments")
    .select("payment_id,purchase_id,status,refunded_amount,period_start,period_end,approved_at,payment_method, purchase:checkout_test_attempts!inner(plan,quantity,total_amount)", { count: "exact" })
    .eq("purchase.user_id", userId).eq("purchase.mode", "production");
  if (purchaseId) query = query.eq("purchase_id", purchaseId);
  const { data, error, count } = await query.order("period_start", { ascending: false }).order("payment_id")
    .range(page * 10, page * 10 + 9);
  if (error) throw new CheckoutError("No pudimos cargar los pagos de tu cuenta.", 503);
  return { count: count ?? 0, payments: data as unknown as (BillingPayment & {
    purchase_id: string; purchase: { plan: BillingPurchase["plan"]; quantity: number; total_amount: number };
  })[] };
}
export async function ownedReceiptPayment(purchaseId: string, paymentId: string) {
  const { data, error } = await createSupabaseServiceClient().from("checkout_payments")
    .select("payment_id,status,refunded_amount,period_start,period_end,approved_at,payment_method")
    .eq("purchase_id", purchaseId).eq("payment_id", paymentId).maybeSingle();
  if (error) throw new CheckoutError("No pudimos cargar el comprobante.", 503);
  return data as BillingPayment | null;
}
