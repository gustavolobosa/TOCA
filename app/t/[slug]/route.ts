import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type RedirectRouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: RedirectRouteContext) {
  const { slug } = await params;
  const supabase = createSupabaseServiceClient();
  const { data: link, error } = await supabase
    .from("nfc_links")
    .select("id, destination_url, is_active")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !link || !link.is_active) {
    return Response.redirect(new URL("/enlace-no-disponible", request.url), 302);
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;
  const { error: eventError } = await supabase.from("redirect_events").insert({
    destination_url: link.destination_url,
    nfc_link_id: link.id,
    user_agent: userAgent,
  });

  if (eventError) {
    console.error("No se pudo registrar la visita del enlace NFC.");
  }

  return new Response(null, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Location: link.destination_url,
    },
    status: 302,
  });
}
