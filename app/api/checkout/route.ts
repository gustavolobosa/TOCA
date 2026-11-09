import { CheckoutError, checkoutOrigin } from "@/lib/checkout/config";
import { readSession, newSession } from "@/lib/checkout/session";
import { checkoutStatus, startCheckout, cancelCheckout } from "@/lib/checkout/mercadopago";
import { getAttempt } from "@/lib/checkout/store";
import { isPlan } from "@/lib/pricing";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store, max-age=0" };
async function handle(request: Request) {
  try {
    const origin = checkoutOrigin(request.headers.get("host"));
    if (request.method !== "GET" && request.headers.get("origin") !== origin) throw new CheckoutError("Origen no permitido.", 403);
    let session = await readSession(origin);
    if (request.method === "POST") {
      if (!request.headers.get("content-type")?.startsWith("application/json") || Number(request.headers.get("content-length")) > 300) throw new CheckoutError("Solicitud inválida.");
      const raw = await request.text();
      if (raw.length > 300) throw new CheckoutError("Solicitud inválida.");
      let body;
      try { body = JSON.parse(raw); } catch { throw new CheckoutError("Solicitud inválida."); }
      if (!body || typeof body !== "object") throw new CheckoutError("Solicitud inválida.");
      if (body.action === "prepare") {
        if (!isPlan(body.plan)) throw new CheckoutError("Selecciona un plan válido.");
        const attempt = session ? await getAttempt(session) : null;
        if (!session || attempt?.state === "cancelled" || attempt?.state === "failed" || (!attempt && session.plan !== body.plan)) {
          session = await newSession(body.plan, origin);
        } else if (session.plan !== body.plan) {
          throw new CheckoutError("Tienes otra compra en curso. Revisa su resultado y cancélala antes de cambiar de plan.", 409);
        }
        return Response.json({ plan: session.plan }, { headers });
      }
      if (!session) throw new CheckoutError("Inicia la compra desde la página de precios.", 401);
      if (body.action === "pay") await startCheckout(session);
      else if (body.action === "cancel") await cancelCheckout(session);
      else throw new CheckoutError("Acción inválida.");
    }
    return Response.json(session ? await checkoutStatus(session) : { state: "empty" }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof CheckoutError ? error.message : "No pudimos confirmar el resultado. Volveremos a verificarlo sin repetir el cobro." },
      { status: error instanceof CheckoutError ? error.status : 502, headers });
  }
}
export const GET = handle;
export const POST = handle;
