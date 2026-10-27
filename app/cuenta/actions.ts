"use server";

import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { parsePassword } from "@/lib/validation";
import type { ActionState } from "@/lib/types";

export async function changePassword(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user } = await requireAccount();
  let password: string;
  try {
    password = parsePassword(formData.get("password"));
    if (password !== formData.get("confirmation")) throw new Error("Las contraseñas no coinciden.");
  } catch (error) { return { error: (error as Error).message }; }
  const currentPassword = formData.get("current_password");
  if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > 1024) return { error: "Ingresa tu contraseña actual." };
  // Reautenticar impide que una sesión sola reemplace la contraseña temporal.
  const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email!, password: currentPassword });
  if (reauthError) return { error: "La contraseña actual no es correcta." };
  const { error } = await supabase.auth.updateUser({ password, current_password: currentPassword });
  if (error) return { error: "No pudimos cambiar la contraseña. Usa una distinta a la actual y vuelve a intentarlo." };
  const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
  if (signOutError) return { error: "La contraseña cambió, pero no pudimos cerrar las sesiones anteriores. Vuelve a entrar para completar el cambio." };
  const { error: profileError } = await createSupabaseServiceClient().rpc("complete_password_change", { actor: user.id });
  if (profileError) return { error: "La contraseña cambió, pero no pudimos completar la actualización de seguridad. Contacta al administrador." };
  redirect("/ingresar?password_changed=1");
}
