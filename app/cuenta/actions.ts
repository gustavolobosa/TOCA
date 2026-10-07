"use server";

import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { parsePassword, parseUserId } from "@/lib/validation";
import type { ActionState } from "@/lib/types";

export type MfaState = ActionState & { factorId?: string; qr?: string; secret?: string };

export async function changePassword(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, user, isAdmin, profile } = await requireAccount();
  if (isAdmin && !profile.must_change_password) {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || data?.currentLevel !== "aal2" || !user.factors?.some(factor => factor.status === "verified" && factor.factor_type === "totp")) redirect("/cuenta/seguridad");
  }
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
  if (isAdmin && !profile.must_change_password) {
    // La reautenticación baja AAL; verificar de nuevo en la nueva sesión.
    const code = formData.get("code");
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp[0];
    if (!factor || typeof code !== "string" || !/^\d{6}$/.test(code)) return { error: "Ingresa el código de seis dígitos del segundo factor." };
    const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (mfaError) return { error: "El código del segundo factor no es correcto." };
  }
  const { error } = await supabase.auth.updateUser({ password, current_password: currentPassword });
  if (error) return { error: "No pudimos cambiar la contraseña. Usa una distinta a la actual y vuelve a intentarlo." };
  const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
  if (signOutError) return { error: "La contraseña cambió, pero no pudimos cerrar las sesiones anteriores. Vuelve a entrar para completar el cambio." };
  const { error: profileError } = await createSupabaseServiceClient().rpc("complete_password_change", { actor: user.id });
  if (profileError) return { error: "La contraseña cambió, pero no pudimos completar la actualización de seguridad. Contacta al administrador." };
  redirect("/ingresar?password_changed=1");
}

export async function enrollMfa(_state: MfaState): Promise<MfaState> {
  void _state;
  const { supabase, isAdmin, profile } = await requireAccount();
  if (!isAdmin || profile.must_change_password) return { error: "Completa primero el cambio de contraseña." };
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) return { error: "No pudimos consultar el segundo factor." };
  if (factors.totp.length) return { error: "Ya tienes un segundo factor. Verifica su código para entrar." };
  for (const pending of factors.all.filter(factor => factor.factor_type === "totp" && factor.status === "unverified")) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: pending.id });
    if (error) return { error: "No pudimos reiniciar la configuración pendiente del segundo factor." };
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "TOCA" });
  if (error) return { error: "No pudimos configurar el segundo factor. Comprueba que TOTP esté habilitado en Supabase." };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyMfa(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, isAdmin, profile } = await requireAccount();
  if (!isAdmin || profile.must_change_password) return { error: "Acceso no autorizado." };
  const rawCode = formData.get("code");
  if (typeof rawCode !== "string" || !/^\d{6}$/.test(rawCode)) return { error: "Ingresa el código de seis dígitos de tu aplicación." };
  let factorId: string;
  try { factorId = parseUserId(formData.get("factor_id")); }
  catch { return { error: "El factor no es válido. Vuelve a cargar la página." }; }
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: rawCode });
  if (error) return { error: "Código incorrecto o vencido. Prueba con el siguiente código." };
  redirect("/panel");
}
