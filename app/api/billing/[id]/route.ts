import { checkoutAccount } from "@/lib/checkout/account";
import { CheckoutError, checkoutOrigin } from "@/lib/checkout/config";
import { findAttempt, purchaseFromAttempt } from "@/lib/checkout/store";
import { billingSubscription, cancelCheckout } from "@/lib/checkout/mercadopago";
import { billingPayments, billingPurchase } from "@/lib/checkout/billing-store";
import { parsePage } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store, max-age=0" };
async function handle(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (request.method === "POST" && request.headers.get("origin") !== checkoutOrigin(request.headers.get("host"))) throw new CheckoutError("Origen no permitido.", 403);
    const { user } = await checkoutAccount();
    const { id } = await context.params;
    let attempt = await findAttempt(id, user.id);
    if (!attempt) throw new CheckoutError("Suscripción no encontrada.", 404);
    const purchase = purchaseFromAttempt(attempt);
    if (request.method === "POST") {
      if (attempt.state === "failed") throw new CheckoutError("Esta compra no tiene una suscripción para cancelar.", 409);
      // Este endpoint solo cancela. Nunca recibe importes, usuarios ni IDs del proveedor del cliente.
      await cancelCheckout(purchase);
      attempt = await findAttempt(id, user.id);
      if (!attempt || attempt.state !== "cancelled") throw new CheckoutError("La cancelación todavía no está confirmada. Vuelve a consultar el estado.", 503);
      return Response.json({ purchase: billingPurchase(attempt), providerStatus: "cancelled", nextPaymentDate: null, checkedAt: new Date().toISOString() }, { headers });
    }
    let page: number;
    try { page = parsePage(new URL(request.url).searchParams.get("page") ?? undefined); }
    catch { throw new CheckoutError("Página inválida."); }
    const history = await billingPayments(attempt, page);
    let providerStatus: string | null = null, nextPaymentDate: string | null = null, warning: string | null = null;
    if (attempt.state !== "failed") {
      try {
        const live = await billingSubscription(purchase, attempt.subscription_id);
        providerStatus = live?.status ?? null; nextPaymentDate = live?.nextPaymentDate ?? null;
      } catch {
        warning = "No pudimos actualizar Mercado Pago. Mostramos los datos guardados; puedes reintentar o solicitar la cancelación.";
      }
    }
    return Response.json({ purchase: billingPurchase(attempt), providerStatus, nextPaymentDate, warning,
      checkedAt: new Date().toISOString(), ...history }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof CheckoutError ? error.message : "No pudimos completar la solicitud. Revisa el estado antes de repetirla." },
      { status: error instanceof CheckoutError ? error.status : 502, headers });
  }
}
export const GET = handle;
export const POST = handle;
