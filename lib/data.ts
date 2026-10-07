import "server-only";
import { notFound } from "next/navigation";
import { requireAdmin, requirePanelAccount } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { parseId } from "@/lib/validation";
import type { NfcLink, Profile } from "@/lib/types";

export async function getNfc(rawId: number) {
  const { supabase } = await requirePanelAccount();
  const { data, error } = await supabase.from("nfc_links").select("*").eq("id", parseId(rawId)).maybeSingle();
  if (error) throw new Error("No pudimos cargar el NFC.");
  if (!data) notFound();
  return data as NfcLink;
}

export async function getProfiles() {
  await requireAdmin();
  const { data, error, count } = await createSupabaseServiceClient().from("profiles")
    .select("id,name,email,is_active,is_admin,must_change_password,created_at,token_valid_after", { count: "exact" })
    .order("name").limit(1000);
  if (error) throw new Error("No pudimos cargar las cuentas.");
  // ponytail: listado acotado para el MVP; agregar búsqueda paginada antes de superar 1000 cuentas.
  if ((count ?? 0) > 1000) throw new Error("El listado supera el límite del MVP. Contacta al administrador.");
  return (data ?? []) as Profile[];
}
