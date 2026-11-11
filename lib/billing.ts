import type { PlanId } from "@/lib/pricing";

export type BillingPurchase = {
  id: string; plan: PlanId; quantity: number; totalAmount: number; unitNet: number | null; promoCode: string | null;
  mode: "test" | "production"; state: "creating" | "ready" | "failed" | "cancelled";
  renewalStatus: string | null; nextPaymentDate: string | null;
  hasSubscription: boolean; fulfilled: boolean; paidUntil: string | null; blocked: boolean; createdAt: string;
};
export type BillingPayment = {
  approved_at: string | null; payment_method: string | null;
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
  const renewal = detail?.providerStatus ?? purchase.renewalStatus;
  if (purchase.state === "cancelled" || ["cancelled", "canceled"].includes(renewal ?? "")) return { label: "Cancelada", tone: "neutral" };
  if (purchase.state === "failed") return { label: "No completada", tone: "neutral" };
  if (purchase.blocked) return { label: "Servicio suspendido", tone: "danger" };
  if (renewal === "paused") return { label: "Renovación pausada", tone: "amber" };
  const paid = purchase.mode === "test" ? purchase.fulfilled : Boolean(purchase.paidUntil && Date.parse(purchase.paidUntil) > now);
  if (renewal === "authorized" && paid) return { label: "Activa", tone: "green" };
  if (renewal === "pending" || (renewal === "authorized" && !paid)) return { label: "Pendiente de pago", tone: "amber" };
  if (paid) return { label: "Período pagado", tone: "green" };
  if (purchase.fulfilled) return { label: "Sin período vigente", tone: "amber" };
  return { label: "Por verificar", tone: "neutral" };
}

export function hasReceipt(status: string) {
  return ["approved", "refunded", "charged_back"].includes(status);
}
export function paymentLabel(status: string, refunded: number) {
  if (status === "approved" && refunded > 0) return "Con devolución";
  const labels: Record<string, string> = { approved: "Pagado", pending: "Pendiente", in_process: "En proceso",
    authorized: "Autorizado", rejected: "Rechazado", cancelled: "Cancelado", refunded: "Devuelto", charged_back: "Contracargo" };
  return labels[status] ?? "En revisión";
}
