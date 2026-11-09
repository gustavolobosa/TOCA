"use server";

import { redirect } from "next/navigation";

import { getAdminUserId } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureCustomerProfile } from "@/lib/customer-profile";
import { authReturnPath } from "@/lib/auth-return";
import { checkoutEnabled } from "@/lib/checkout/config";

function loginError(message: string, next: string): never {
  redirect(`/ingresar?error=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`);
}

export async function signIn(formData: FormData) {
  const next = authReturnPath(formData.get("next"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || email.length > 254 || !password || password.length > 1024) {
    loginError("Correo o contraseña incorrectos.", next);
  }

  getAdminUserId();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    loginError("Correo o contraseña incorrectos, o correo sin confirmar.", next);
  }

  if (checkoutEnabled() && data.user.email_confirmed_at) {
    try { await ensureCustomerProfile(data.user); }
    catch (error) { loginError((error as Error).message, next); }
  }

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("is_active").eq("id", data.user.id).maybeSingle();
  if (profileError) {
    await supabase.auth.signOut({ scope: "local" });
    loginError("El acceso aún no está configurado. Contacta al administrador.", next);
  }
  if (!profile?.is_active) {
    await supabase.auth.signOut({ scope: "local" });
    loginError("Correo o contraseña incorrectos.", next);
  }

  redirect(next);
}
