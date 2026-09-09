"use server";

import { redirect } from "next/navigation";

import { getAdminEmail } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function loginError(message: string): never {
  redirect(`/ingresar?error=${encodeURIComponent(message)}`);
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (email !== getAdminEmail()) {
    loginError("Este correo no tiene acceso al panel.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    loginError("Correo o contraseña incorrectos.");
  }

  if (data.user.email?.toLowerCase() !== getAdminEmail()) {
    await supabase.auth.signOut();
    loginError("Este correo no tiene acceso al panel.");
  }

  redirect("/panel");
}
