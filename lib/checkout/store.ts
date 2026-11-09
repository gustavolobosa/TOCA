import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { isPlan, isNfcQuantity } from "@/lib/pricing";
import { CheckoutError } from "./config";
import type { CheckoutPurchase } from "./session";

export type Attempt = {
  id: string; plan: string; quantity: number; user_id: string | null; origin: string | null;
  total_amount: number | null; payment_id: string | null; fulfilled_at: string | null;
  subscription_id: string | null; state: "creating" | "ready" | "failed" | "cancelled"; created_at: string;
};
const columns = "id,plan,quantity,user_id,origin,total_amount,payment_id,fulfilled_at,subscription_id,state,created_at";
const storageError = () => new CheckoutError("No se pudo acceder a tus compras. Revisa las variables y la migración de Supabase.", 503);
function db() {
  try { return createSupabaseServiceClient(); } catch { throw storageError(); }
}
export function purchaseFromAttempt(attempt: Attempt): CheckoutPurchase {
  if (!attempt.user_id || !attempt.origin || !isPlan(attempt.plan) || !isNfcQuantity(attempt.quantity) || !Number.isSafeInteger(attempt.total_amount) || attempt.total_amount! < 1) {
    throw new CheckoutError("Esta compra no tiene un usuario asociado. Las pruebas anteriores se conservan sin asignar NFC.", 409);
  }
  return { id: attempt.id, plan: attempt.plan, quantity: attempt.quantity, userId: attempt.user_id, origin: attempt.origin, totalAmount: attempt.total_amount! };
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
  if (data && (data.plan !== purchase.plan || data.quantity !== purchase.quantity || data.total_amount !== purchase.totalAmount)) throw new CheckoutError("La compra no corresponde a esta sesión.", 403);
  return data;
}
export async function listAttempts(userId: string) {
  const { data, error } = await db().from("checkout_test_attempts").select(columns).eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
  if (error) throw storageError();
  return data as Attempt[];
}
export async function claimAttempt(purchase: CheckoutPurchase) {
  const { error } = await db().from("checkout_test_attempts").insert({ id: purchase.id, plan: purchase.plan, quantity: purchase.quantity,
    user_id: purchase.userId, origin: purchase.origin, total_amount: purchase.totalAmount });
  if (error?.code === "23505") return false;
  if (error) throw storageError();
  return true;
}
export async function saveAttempt(purchase: CheckoutPurchase, values: Pick<Attempt, "state"> & Partial<Pick<Attempt, "subscription_id">>) {
  const { data, error } = await db().from("checkout_test_attempts").update(values).eq("id", purchase.id).eq("user_id", purchase.userId)
    .eq("plan", purchase.plan).eq("quantity", purchase.quantity).select("id").single();
  if (error || !data) throw storageError();
}
export async function fulfillPurchase(purchase: CheckoutPurchase, subscriptionId: string, paymentId: number) {
  const { data, error } = await db().rpc("fulfill_checkout_test_purchase", {
    purchase_id: purchase.id, provider_subscription: subscriptionId, provider_payment: String(paymentId),
    paid_amount: purchase.totalAmount, paid_currency: "CLP",
  });
  if (error || data !== purchase.quantity) throw new CheckoutError("El pago está aprobado, pero todavía no pudimos asignar tus NFC. Reintentaremos sin cobrar otra vez.", 503);
}
