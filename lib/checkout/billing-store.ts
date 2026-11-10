import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isPlan } from "@/lib/pricing";
import { CheckoutError } from "./config";
import type { Attempt } from "./store";
import type { BillingPurchase, BillingPayment } from "@/lib/billing";

export function billingPurchase(attempt: Attempt): BillingPurchase {
  if (!isPlan(attempt.plan) || !attempt.user_id || !Number.isSafeInteger(attempt.total_amount)) throw new CheckoutError("No pudimos leer esta suscripción.", 503);
  return { id: attempt.id, plan: attempt.plan, quantity: attempt.quantity, totalAmount: attempt.total_amount!,
    unitNet: attempt.unit_net, promoCode: attempt.promo_code, mode: attempt.mode, state: attempt.state,
    hasSubscription: Boolean(attempt.subscription_id), fulfilled: Boolean(attempt.fulfilled_at), paidUntil: attempt.paid_until,
    blocked: attempt.billing_blocked, createdAt: attempt.created_at };
}
export async function billingPurchases(userId: string, page: number) {
  const { data, error, count } = await createSupabaseServiceClient().from("checkout_test_attempts")
    .select("id,plan,quantity,total_amount,unit_net,promo_code,mode,state,subscription_id,fulfilled_at,paid_until,billing_blocked,created_at,user_id", { count: "exact" })
    .eq("user_id", userId).order("created_at", { ascending: false }).order("id").range(page * 10, page * 10 + 9);
  if (error) throw new CheckoutError("No pudimos cargar tus suscripciones. Intenta nuevamente.", 503);
  return { purchases: (data as Attempt[]).map(billingPurchase), count: count ?? 0, now: Date.now() };
}
// Llamar solo después de verificar la propiedad con findAttempt(id, user.id).
export async function billingPayments(attempt: Attempt, page: number) {
  if (attempt.mode === "test") return { payments: [], paymentCount: 0, paymentPage: page };
  const { data, error, count } = await createSupabaseServiceClient().from("checkout_payments")
    .select("payment_id,status,refunded_amount,period_start,period_end", { count: "exact" })
    .eq("purchase_id", attempt.id).order("period_start", { ascending: false }).order("payment_id").range(page * 10, page * 10 + 9);
  if (error) throw new CheckoutError("No pudimos consultar el historial de pagos.", 503);
  return { payments: data as BillingPayment[], paymentCount: count ?? 0, paymentPage: page };
}
