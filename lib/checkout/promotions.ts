import "server-only";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { plans, type PlanId } from "@/lib/pricing";
import { CheckoutError, type CheckoutMode } from "./config";

export type PromotionPrice = { promoId: string; promoCode: string; unitNet: number };
export function normalizePromoCode(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new CheckoutError("Código promocional inválido.");
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw new CheckoutError("El código debe tener entre 3 y 32 letras, números, guiones o guiones bajos.");
  return code;
}
export function promotionError(message?: string): never {
  const messages: Record<string, string> = {
    promo_unavailable: "El código no está disponible o está vencido.",
    promo_used: "Ya utilizaste este código o tienes una compra pendiente con él. Revisa Mis compras.",
    promo_full: "Este código no tiene cupos disponibles. Algunos pueden estar reservados por pagos pendientes.",
    promo_changed: "El precio del código cambió. Quítalo y vuelve a aplicarlo antes de pagar.",
    promo_monthly: "Los códigos promocionales solo se aplican al plan mensual.",
  };
  throw new CheckoutError(messages[message ?? ""] ?? "No pudimos verificar la promoción. Intenta nuevamente.", messages[message ?? ""] ? 409 : 503);
}
export async function quotePromotion(code: string, plan: PlanId, userId: string, mode: CheckoutMode): Promise<PromotionPrice | null> {
  if (!code) return null;
  if (plan !== "mensual") promotionError("promo_monthly");
  const { data, error } = await createSupabaseServiceClient().rpc("quote_checkout_promotion", {
    requested_code: code, customer: userId, checkout_mode: mode,
  });
  if (error) promotionError(error.message);
  if (!data || typeof data.id !== "string" || data.code !== code || !Number.isSafeInteger(data.unit_net) || data.unit_net < 1) promotionError();
  return { promoId: data.id, promoCode: data.code, unitNet: data.unit_net };
}
export function purchasePrice(plan: PlanId, quantity: number, promotion: PromotionPrice | null) {
  const unitNet = promotion?.unitNet ?? plans[plan].net;
  return { unitNet, totalAmount: Math.round(unitNet * 119 / 100) * quantity };
}
