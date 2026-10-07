"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin, requirePanelAccount } from "@/lib/auth";
import { getNfc } from "@/lib/data";
import { parseDestination } from "@/lib/destinations";
import { getSiteUrl } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseName } from "@/lib/urls";
import { parseId, parseUserId } from "@/lib/validation";

function formError(path: string, error: unknown): never {
  const message = error instanceof Error ? error.message : "No pudimos guardar los cambios.";
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createNfcLink(formData: FormData) {
  const { user } = await requireAdmin();

  try {
    const name = parseName(formData.get("name"));
    const destination = parseDestination(formData.get("destination_type"), formData.get("destination"), getSiteUrl());
    const { error } = await createSupabaseServiceClient().rpc("create_nfc", {
      actor: user.id, target: parseUserId(formData.get("owner_id")), title: name,
      tag_slug: randomBytes(12).toString("base64url"), kind: destination.destination_type, url: destination.destination_url,
    });

    if (error) throw new Error("No pudimos crear el NFC. Comprueba que el propietario esté activo.");
  } catch (error) {
    formError("/panel/nuevo", error);
  }

  revalidatePath("/panel");
  redirect("/panel?created=1");
}

export async function updateNfcLink(id: number, formData: FormData) {
  const { user } = await requirePanelAccount();
  parseId(id);
  await getNfc(id);

  try {
    const name = parseName(formData.get("name"));
    const destination = parseDestination(formData.get("destination_type"), formData.get("destination"), getSiteUrl());
    const { error } = await createSupabaseServiceClient().rpc("update_nfc", {
      actor: user.id, tag_id: id, title: name, kind: destination.destination_type,
      url: destination.destination_url, active: formData.get("is_active") === "on",
    });

    if (error) throw new Error("No pudimos guardar. La cuenta debe estar activa; configura un destino nuevo si el NFC fue reasignado.");
  } catch (error) {
    formError(`/panel/${id}/editar`, error);
  }

  revalidatePath("/panel");
  revalidatePath(`/panel/${id}`);
  redirect("/panel?updated=1");
}

export async function setNfcLinkActive(id: number, nextActive: boolean) {
  const { user } = await requirePanelAccount();
  const link = await getNfc(parseId(id));
  if (typeof nextActive !== "boolean") throw new Error("Estado no válido.");
  if (link.requires_configuration && nextActive) redirect(`/panel/${id}/editar`);
  const { error } = await createSupabaseServiceClient().rpc("update_nfc", {
    actor: user.id, tag_id: id, title: link.name, kind: link.destination_type,
    url: link.destination_url, active: nextActive,
  });

  if (error) {
    redirect("/panel?error=No+pudimos+cambiar+el+estado.");
  }

  revalidatePath("/panel");
}

export async function reassignNfc(rawId: number, formData: FormData) {
  const { user } = await requireAdmin();
  const id = parseId(rawId);
  await getNfc(id);
  try {
    if (formData.get("confirm_transfer") !== "on") throw new Error("Confirma que se transferirá todo el historial al nuevo propietario.");
    const { error } = await createSupabaseServiceClient().rpc("reassign_nfc", {
      actor: user.id, tag_id: id, target: parseUserId(formData.get("owner_id")),
    });
    if (error) throw new Error("No pudimos reasignar. Elige otro propietario activo.");
  } catch (error) { formError(`/panel/${id}`, error); }
  revalidatePath("/panel");
  revalidatePath(`/panel/${id}`);
  redirect(`/panel/${id}?transferred=1`);
}

export async function signOut() {
  // Salir también debe funcionar con una cuenta desactivada o pendiente de MFA.
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/ingresar");
}
