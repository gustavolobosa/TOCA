"use server";

import { redirect } from "next/navigation";

import { getAdminUserId } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function loginError(message: string): never {
  redirect(`/ingresar?error=${encodeURIComponent(message)}`);
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || email.length > 254 || !password || password.length > 1024) {
    loginError("Correo o contraseña incorrectos.");
  }

  getAdminUserId();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    loginError("Correo o contraseña incorrectos.");
  }

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("is_active").eq("id", data.user.id).maybeSingle();
  if (profileError) {
    await supabase.auth.signOut({ scope: "local" });
    loginError("El acceso aún no está configurado. Contacta al administrador.");
  }
  if (!profile?.is_active) {
    await supabase.auth.signOut({ scope: "local" });
    loginError("Correo o contraseña incorrectos.");
  }

  redirect("/panel");
}
