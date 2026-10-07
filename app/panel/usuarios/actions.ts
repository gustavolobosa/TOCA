"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { parseName } from "@/lib/urls";
import { parseEmail, parseUserId } from "@/lib/validation";
import type { ActionState } from "@/lib/types";

export async function createUser(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireAdmin();
  let name: string, email: string;
  try { name = parseName(formData.get("name")); email = parseEmail(formData.get("email")); }
  catch (error) { return { error: (error as Error).message }; }
  const password = `Aa1!${randomBytes(18).toString("base64url")}`;
  const service = createSupabaseServiceClient();
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return { error: "No pudimos crear la cuenta. Comprueba que el correo no esté registrado." };
  const { error: profileError } = await service.rpc("register_profile", {
    actor: user.id, target: data.user.id, display_name: name, target_email: email,
  });
  if (profileError) return { error: "La cuenta se creó en Auth, pero su acceso quedó bloqueado. Revisa el perfil antes de intentar crearla de nuevo." };
  revalidatePath("/panel/usuarios");
  return { success: "Cuenta creada. Comparte la contraseña temporal por un canal privado; no se envió por correo.", email, password };
}

export async function setUserActive(target: string, active: boolean, _state: ActionState): Promise<ActionState> {
  void _state;
  const { user } = await requireAdmin();
  const id = parseUserId(target);
  if (typeof active !== "boolean" || id === user.id) return { error: "No puedes desactivar al administrador." };
  const { error } = await createSupabaseServiceClient().rpc("set_profile_active", { actor: user.id, target: id, active });
  if (error) return { error: "No pudimos cambiar el estado de la cuenta." };
  revalidatePath("/panel/usuarios"); revalidatePath("/panel");
  return { success: active ? "Cuenta reactivada. Sus NFC siguen pausados." : "Cuenta desactivada y NFC pausados." };
}
