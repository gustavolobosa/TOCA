"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureCustomerProfile } from "@/lib/customer-profile";
import { authReturnPath } from "@/lib/auth-return";
import { parseEmail, parsePassword } from "@/lib/validation";
import { checkoutEnabled } from "@/lib/checkout/config";

export type RegistrationState = { email?: string; sent?: boolean; error?: string; message?: string };
export async function register(_state: RegistrationState, form: FormData): Promise<RegistrationState> {
  if (!checkoutEnabled()) return { error: "El registro no está disponible." };
  const intent = form.get("intent");
  let email: string;
  try { email = parseEmail(form.get("email")); }
  catch (error) { return { error: (error as Error).message }; }
  const supabase = await createSupabaseServerClient();
  if (intent === "signup") {
    let password: string;
    try { password = parsePassword(form.get("password")); }
    catch (error) { return { error: (error as Error).message }; }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: "No pudimos iniciar el registro. Comprueba los datos o espera unos minutos antes de reintentar." };
    if (data.session) {
      await supabase.auth.signOut({ scope: "local" });
      return { error: "La confirmación de correo debe estar activada en Supabase para registrar clientes." };
    }
    return { email, sent: true, message: "Revisa tu correo e ingresa el código de confirmación. Si ya tenías una cuenta, inicia sesión." };
  }
  if (intent === "resend") {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    return { email, sent: true, ...(error ? { error: "No pudimos reenviar el código. Espera un minuto y vuelve a intentarlo." } : { message: "Si la cuenta está pendiente de confirmación, recibirás un nuevo código." }) };
  }
  if (intent !== "verify") return { error: "Solicitud inválida." };
  const token = String(form.get("token") ?? "").trim();
  if (!/^\d{6,10}$/.test(token)) return { email, sent: true, error: "Ingresa el código que recibiste por correo." };
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
  if (error || !data.user?.email_confirmed_at || !data.session) return { email, sent: true, error: "El código es incorrecto o venció. Puedes solicitar otro." };
  try { await ensureCustomerProfile(data.user); }
  catch (error) { return { email, sent: true, error: `${(error as Error).message} Tu correo ya está confirmado; podrás continuar desde Ingresar.` }; }
  redirect(authReturnPath(form.get("next")));
}
