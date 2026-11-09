"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { normalizePromoCode } from "@/lib/checkout/promotions";
import { parseUserId } from "@/lib/validation";
import type { ActionState } from "@/lib/types";

export async function savePromotion(id: string | null, _state: ActionState, form: FormData): Promise<ActionState> {
  const { user } = await requireAdmin();
  let code: string, price: number, limit: number | null, date: string | null;
  try {
    if (id) parseUserId(id);
    code = normalizePromoCode(form.get("code"));
    if (!code) throw new Error("Ingresa un código.");
    price = Number(form.get("unitNet"));
    if (!Number.isSafeInteger(price) || price < 1 || price > 1000000) throw new Error("El precio debe ser un entero entre $1 y $1.000.000, sin IVA.");
    const rawLimit = form.get("maxUses");
    limit = rawLimit === "" ? null : Number(rawLimit);
    if (limit !== null && (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000000)) throw new Error("El máximo debe ser un entero entre 1 y 1.000.000, o quedar vacío.");
    const rawDate = form.get("expiresOn");
    date = rawDate === "" ? null : String(rawDate);
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error("Selecciona una fecha válida.");
  } catch (error) { return { error: (error as Error).message }; }
  const { error } = await createSupabaseServiceClient().rpc("save_checkout_promotion", {
    actor: user.id, promotion_id: id, requested_code: code, price, enabled: form.get("active") === "on", expiry_date: date, usage_limit: limit,
  });
  if (error) return { error: error.code === "23505" ? "Este código ya existe. Edita el existente." : error.message === "promo_limit_below_usage" ?
    "El máximo no puede ser menor que los usos consumidos y reservados. Desactiva el código si quieres detener nuevas compras." : "No pudimos guardar el código. Comprueba los datos y que la migración esté aplicada." };
  revalidatePath("/panel/promociones");
  return { success: "Código guardado. Las suscripciones ya creadas conservan su precio." };
}
