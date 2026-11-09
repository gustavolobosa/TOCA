import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { CheckoutError } from "./config";
import type { CheckoutSession } from "./session";

export type Attempt = { id: string; plan: string; subscription_id: string | null; state: "creating" | "ready" | "failed" | "cancelled"; created_at: string };
function db() {
  try { return createSupabaseServiceClient(); }
  catch { throw storageError(); }
}
const storageError = () => new CheckoutError("No se pudo acceder al registro de compras de prueba. Revisa las variables y la migración de Supabase.", 503);
export async function getAttempt(session: CheckoutSession) {
  const { data, error } = await db().from("checkout_test_attempts").select("id,plan,subscription_id,state,created_at").eq("id", session.id).maybeSingle();
  if (error) throw storageError();
  if (data && data.plan !== session.plan) throw new CheckoutError("La compra no corresponde a esta sesión.", 403);
  return data as Attempt | null;
}
export async function claimAttempt(session: CheckoutSession) {
  const { error } = await db().from("checkout_test_attempts").insert({ id: session.id, plan: session.plan });
  if (error?.code === "23505") return false;
  if (error) throw storageError();
  return true;
}
export async function saveAttempt(session: CheckoutSession, values: Pick<Attempt, "state"> & Partial<Pick<Attempt, "subscription_id">>) {
  const { data, error } = await db().from("checkout_test_attempts").update(values).eq("id", session.id).eq("plan", session.plan).select("id").single();
  if (error || !data) throw storageError();
}
