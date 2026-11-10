import type { PlanId } from "@/lib/pricing";

export type BillingPurchase = {
  id: string; plan: PlanId; quantity: number; totalAmount: number; unitNet: number | null; promoCode: string | null;
  mode: "test" | "production"; state: "creating" | "ready" | "failed" | "cancelled";
  hasSubscription: boolean; fulfilled: boolean; paidUntil: string | null; blocked: boolean; createdAt: string;
};
export type BillingPayment = {
  payment_id: string; status: string; refunded_amount: number; period_start: string; period_end: string;
};
export type BillingDetail = {
  purchase: BillingPurchase; providerStatus: string | null; nextPaymentDate: string | null;
  warning: string | null; checkedAt: string; payments: BillingPayment[]; paymentCount: number; paymentPage: number;
};
export function billingDate(value: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", dateStyle: "medium" }).format(new Date(value)) : "Por confirmar";
}
export function billingState(purchase: BillingPurchase, detail: BillingDetail | null, now: number) {
  if (purchase.state === "cancelled" || ["cancelled", "canceled"].includes(detail?.providerStatus ?? "")) return { label: "Cancelada", tone: "neutral" };
  if (purchase.state === "failed") return { label: "No completada", tone: "neutral" };
  if (purchase.blocked) return { label: "Servicio suspendido", tone: "danger" };
  if (detail?.providerStatus === "paused") return { label: "Renovación pausada", tone: "amber" };
  const paid = purchase.mode === "test" ? purchase.fulfilled : Boolean(purchase.paidUntil && Date.parse(purchase.paidUntil) > now);
  if (detail?.providerStatus === "authorized" && paid) return { label: "Activa", tone: "green" };
  if (detail?.providerStatus === "pending" || (detail?.providerStatus === "authorized" && !paid)) return { label: "Pendiente de pago", tone: "amber" };
  if (paid) return { label: "Período pagado", tone: "green" };
  if (purchase.fulfilled) return { label: "Sin período vigente", tone: "amber" };
  return { label: "Por verificar", tone: "neutral" };
}
