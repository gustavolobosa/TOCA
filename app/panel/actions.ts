"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { parseHttpsUrl, parseName } from "@/lib/urls";

function formError(path: string, error: unknown): never {
  const message = error instanceof Error ? error.message : "No pudimos guardar los cambios.";
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createNfcLink(formData: FormData) {
  const { supabase, user } = await requireAdmin();

  try {
    const name = parseName(formData.get("name"));
    const destinationUrl = parseHttpsUrl(formData.get("destination_url"));
    const slug = randomBytes(7).toString("base64url");
    const { error } = await supabase.from("nfc_links").insert({
      destination_url: destinationUrl,
      name,
      owner_id: user.id,
      slug,
    });

    if (error) throw new Error("No pudimos crear el enlace.");
  } catch (error) {
    formError("/panel/nuevo", error);
  }

  revalidatePath("/panel");
  redirect("/panel?created=1");
}

export async function updateNfcLink(id: number, formData: FormData) {
  const { supabase, user } = await requireAdmin();

  try {
    const name = parseName(formData.get("name"));
    const destinationUrl = parseHttpsUrl(formData.get("destination_url"));
    const { error } = await supabase
      .from("nfc_links")
      .update({ destination_url: destinationUrl, name })
      .eq("id", id)
      .eq("owner_id", user.id);

    if (error) throw new Error("No pudimos guardar los cambios.");
  } catch (error) {
    formError(`/panel/${id}/editar`, error);
  }

  revalidatePath("/panel");
  redirect("/panel?updated=1");
}

export async function setNfcLinkActive(id: number, nextActive: boolean) {
  const { supabase, user } = await requireAdmin();
  const { error } = await supabase
    .from("nfc_links")
    .update({ is_active: nextActive })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    redirect("/panel?error=No+pudimos+cambiar+el+estado.");
  }

  revalidatePath("/panel");
}

export async function signOut() {
  const { supabase } = await requireAdmin();
  await supabase.auth.signOut();
  redirect("/ingresar");
}
