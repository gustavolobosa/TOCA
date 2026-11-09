import { CheckoutError, checkoutOrigin, checkoutMode } from "@/lib/checkout/config";
import { readSession, newSession } from "@/lib/checkout/session";
import type { CheckoutPurchase } from "@/lib/checkout/session";
import { checkoutAccount } from "@/lib/checkout/account";
import { checkoutStatus, startCheckout, cancelCheckout } from "@/lib/checkout/mercadopago";
import { getAttempt, findAttempt, listAttempts, purchaseFromAttempt } from "@/lib/checkout/store";
import { isPlan, isNfcQuantity, maxNfcQuantity } from "@/lib/pricing";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store, max-age=0" };
async function handle(request: Request) {
  try {
    const origin = checkoutOrigin(request.headers.get("host"));
    if (request.method !== "GET" && request.headers.get("origin") !== origin) throw new CheckoutError("Origen no permitido.", 403);
    const { user } = await checkoutAccount();
    let session: CheckoutPurchase | null = await readSession(origin, user.id);
    const purchaseId = new URL(request.url).searchParams.get("compra");
    if (purchaseId) {
      const purchase = await findAttempt(purchaseId, user.id);
      if (!purchase) throw new CheckoutError("Compra no encontrada.", 404);
      session = purchaseFromAttempt(purchase);
    } else if (!session) {
      const latest = (await listAttempts(user.id)).find(item => item.mode === checkoutMode());
      if (latest) session = purchaseFromAttempt(latest);
    }
    if (request.method === "POST") {
      if (!request.headers.get("content-type")?.startsWith("application/json") || Number(request.headers.get("content-length")) > 300) throw new CheckoutError("Solicitud inválida.");
      const raw = await request.text();
      if (raw.length > 300) throw new CheckoutError("Solicitud inválida.");
      let body;
      try { body = JSON.parse(raw); } catch { throw new CheckoutError("Solicitud inválida."); }
      if (!body || typeof body !== "object") throw new CheckoutError("Solicitud inválida.");
      if (body.action === "prepare") {
        if (!checkoutMode()) throw new CheckoutError("Las compras nuevas están deshabilitadas.", 503);
        if (!isPlan(body.plan)) throw new CheckoutError("Selecciona un plan válido.");
        const quantity = body.quantity === undefined ? 1 : body.quantity;
        if (!isNfcQuantity(quantity)) throw new CheckoutError(`Selecciona una cantidad entera entre 1 y ${maxNfcQuantity} NFC.`);
        const attempt = session ? await getAttempt(session) : null;
        const changed = session && (session.plan !== body.plan || session.quantity !== quantity);
        if (!session || session.mode !== checkoutMode() || attempt?.fulfilled_at || attempt?.state === "cancelled" || attempt?.state === "failed" || (!attempt && changed)) {
          session = await newSession(body.plan, quantity, origin, user.id, user.email!);
        } else if (changed) {
          throw new CheckoutError("Tienes otra compra en curso. Revisa su resultado y cancélala antes de cambiar el plan o la cantidad.", 409);
        }
        return Response.json({ plan: session.plan, quantity: session.quantity }, { headers });
      }
      if (!session) throw new CheckoutError("Inicia la compra desde la página de precios.", 401);
      if (body.action === "pay") {
        if (body.plan !== session.plan || body.quantity !== session.quantity) {
          throw new CheckoutError("La selección cambió. Recarga la página para revisar el plan y la cantidad antes de pagar.", 409);
        }
        await startCheckout(session);
      }
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
