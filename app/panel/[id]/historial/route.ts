import { getAccount } from "@/lib/auth";
import { parseId } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  const account = await getAccount();
  if (!account || !account.profile.is_active || account.profile.must_change_password) return Response.json({ error: "Sesión no disponible." }, { status: 401, headers });
  let id: number;
  try { id = parseId((await params).id); } catch { return Response.json({ error: "NFC no disponible." }, { status: 404, headers }); }
  const { supabase } = account;
  const link = await supabase.from("nfc_links").select("id").eq("id", id).maybeSingle();
  if (link.error) return Response.json({ error: "No pudimos cargar el NFC." }, { status: 503, headers });
  if (!link.data) return Response.json({ error: "NFC no disponible." }, { status: 404, headers });
  const history = await supabase.from("nfc_destination_history").select("id,nfc_link_id,destination_url,destination_type,created_at")
    .eq("nfc_link_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).range(0, 19);
  if (history.error) return Response.json({ error: "No pudimos cargar el historial." }, { status: 503, headers });
  return Response.json({ items: history.data ?? [] }, { headers });
}
