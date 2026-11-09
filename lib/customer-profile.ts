import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { User } from "@supabase/supabase-js";

export async function ensureCustomerProfile(user: User) {
  if (!user.email_confirmed_at || !user.email) throw new Error("Confirma tu correo para continuar.");
  const { error } = await createSupabaseServiceClient().rpc("ensure_customer_profile", { target: user.id, verified_email: user.email });
  if (error) throw new Error("No pudimos preparar tu cuenta. Revisa la confirmación del correo y la migración de registro.");
}
