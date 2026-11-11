import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { billingDate, paymentLabel, type BillingPayment } from "@/lib/billing";
import { plans, pesos } from "@/lib/pricing";
import type { CheckoutPurchase } from "./session";

export async function createReceipt(purchase: CheckoutPurchase, payment: BillingPayment) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Comprobante de pago TOCA");
  pdf.setAuthor("TOCA");
  const page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(.09,.17,.29), muted = rgb(.32,.39,.46);
  const text = (value: string, x: number, y: number, size = 12, strong = false) =>
    page.drawText(value, { x, y, size, font: strong ? bold : regular, color: strong ? ink : muted });
  text("TOCA", 56, 760, 32, true);
  text("Comprobante de pago", 56, 694, 25, true);
  text("Emitido por TOCA", 56, 670);
  page.drawRectangle({ x: 56, y: 555, width: 483, height: 82, color: rgb(.93,.95,.98) });
  text("Total del cobro con IVA", 72, 610);
  text(pesos(purchase.totalAmount) + " CLP", 72, 573, 27, true);
  const rows = [
    ["Fecha de aprobación", billingDate(payment.approved_at)],
    ["Suscripción", plans[purchase.plan].name + " · " + purchase.quantity + " NFC"],
    ["Período", billingDate(payment.period_start) + " hasta " + billingDate(payment.period_end)],
    ["Medio de pago", payment.payment_method?.toUpperCase() || "Sin información"],
    ["Operación Mercado Pago", payment.payment_id],
    ["Estado", paymentLabel(payment.status, payment.refunded_amount)],
  ];
  if (payment.refunded_amount > 0) rows.push(["Monto devuelto", pesos(payment.refunded_amount)]);
  if (purchase.promoCode) rows.push(["Promoción", purchase.promoCode]);
  rows.forEach(([key, value], index) => {
    const y = 512 - index * 35;
    text(key, 56, y, 11);
    text(value, 539 - bold.widthOfTextAtSize(value, 11), y, 11, true);
    page.drawLine({ start: { x: 56, y: y - 10 }, end: { x: 539, y: y - 10 }, thickness: .5, color: rgb(.84,.88,.92) });
  });
  text("Respaldo del pago registrado en TOCA. Sin valor tributario.", 56, 110, 10);
  return pdf.save();
}
