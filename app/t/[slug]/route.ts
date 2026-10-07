import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getSiteUrl } from "@/lib/env";
import { parseHttpsUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

type RedirectRouteContext = { params: Promise<{ slug: string }> };

async function resolve(request: Request, { params }: RedirectRouteContext, record: boolean) {
  const { slug } = await params;
  let location = new URL("/enlace-no-disponible", request.url).toString();
  if (/^[A-Za-z0-9_-]{8,32}$/.test(slug)) {
    try {
      const prefetch = request.headers.get("purpose") === "prefetch" ||
        request.headers.get("sec-purpose")?.includes("prefetch") || request.headers.has("next-router-prefetch");
      const { data, error } = await createSupabaseServiceClient().rpc("resolve_nfc", {
        tag_slug: slug, record_visit: record && !prefetch,
      }).abortSignal(AbortSignal.timeout(4000));
      if (!error && data) {
        location = parseHttpsUrl(data.destination_url, getSiteUrl());
        if (record && !prefetch && !data.recorded) console.error("No se pudo registrar una visita NFC.");
      }
    } catch { console.error("No se pudo resolver el enlace NFC."); }
  }

  return new Response(null, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Location: location,
      "Referrer-Policy": "no-referrer",
    },
    status: 302,
  });
}

export async function GET(request: Request, context: RedirectRouteContext) { return resolve(request, context, true); }
export async function HEAD(request: Request, context: RedirectRouteContext) { return resolve(request, context, false); }
