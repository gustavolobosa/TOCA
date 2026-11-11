import { checkoutAccount } from "@/lib/checkout/account";
import { CheckoutError } from "@/lib/checkout/config";
import { findAttempt, purchaseFromAttempt } from "@/lib/checkout/store";
import { ownedReceiptPayment } from "@/lib/checkout/billing-store";
import { receiptPayment } from "@/lib/checkout/mercadopago";
import { hasReceipt } from "@/lib/billing";
import { createReceipt } from "@/lib/checkout/receipt";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, context: { params: Promise<{ id: string; paymentId: string }> }) {
  try {
    const { user } = await checkoutAccount();
    const { id, paymentId } = await context.params;
    const missing = new CheckoutError("Comprobante no disponible.", 404);
    if (!/^\d{1,24}$/.test(paymentId)) throw missing;
    const attempt = await findAttempt(id, user.id);
    if (attempt?.mode !== "production") throw missing;
    const payment = await ownedReceiptPayment(attempt.id, paymentId);
    if (!payment || !hasReceipt(payment.status)) throw missing;
    const purchase = purchaseFromAttempt(attempt);
    if (!payment.approved_at || !payment.payment_method) {
      const original = await receiptPayment(purchase, paymentId);
      if (!hasReceipt(original.status)) throw missing;
      payment.approved_at ??= original.date_approved ?? null;
      payment.payment_method ??= original.payment_method_id ?? null;
      payment.refunded_amount = Math.max(payment.refunded_amount, original.transaction_amount_refunded ?? 0);
      if (original.status !== "approved") payment.status = original.status;
    }
    const bytes = await createReceipt(purchase, payment);
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="TOCA-comprobante-' + paymentId + '.pdf"' } });
  } catch (error) {
    return Response.json({ error: error instanceof CheckoutError ? error.message : "No pudimos generar el comprobante. Intenta nuevamente." },
      { status: error instanceof CheckoutError ? error.status : 503, headers });
  }
}
