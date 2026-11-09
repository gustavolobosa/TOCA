import { createHmac, timingSafeEqual } from "node:crypto";
import { checkoutEnabled, checkoutSecret, CheckoutError } from "@/lib/checkout/config";
import { reconcileNotification } from "@/lib/checkout/mercadopago";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!checkoutEnabled()) return new Response(null, { status: 404 });
  try {
    const secret = checkoutSecret("MERCADOPAGO_WEBHOOK_SECRET");
    const id = new URL(request.url).searchParams.get("data.id")?.toLowerCase();
    const requestId = request.headers.get("x-request-id");
    const signature = request.headers.get("x-signature") ?? "";
    const ts = /(?:^|,)\s*ts=(\d+)/.exec(signature)?.[1];
    const v1 = /(?:^|,)\s*v1=([a-f0-9]{64})(?:,|$)/i.exec(signature)?.[1];
    if (!id || !/^[a-z0-9_-]{1,64}$/.test(id) || !requestId || requestId.length > 200 || !ts || !v1) return new Response(null, { status: 401 });
    const expected = createHmac("sha256", secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest();
    if (!timingSafeEqual(expected, Buffer.from(v1, "hex"))) return new Response(null, { status: 401 });
    if (Number(request.headers.get("content-length")) > 16384) return new Response(null, { status: 413 });
    const raw = await request.text();
    if (raw.length > 16384) return new Response(null, { status: 413 });
    let body;
    try { body = JSON.parse(raw); } catch { return new Response(null, { status: 400 }); }
    if (!body || String(body.data?.id).toLowerCase() !== id) return new Response(null, { status: 400 });
    if (!["payment", "subscription_preapproval", "subscription_authorized_payment"].includes(body.type)) return new Response(null, { status: 200 });
    await reconcileNotification(body.type, id);
    return new Response(null, { status: 200 });
  } catch (error) {
    // No registrar credenciales ni el cuerpo. Los errores temporales permiten que Mercado Pago reintente.
    return Response.json({ error: "No se pudo procesar la notificación." }, { status: error instanceof CheckoutError && error.status < 500 ? error.status : 503 });
  }
}
