import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isPlan, isNfcQuantity, type PlanId } from "@/lib/pricing";
import { CheckoutError, checkoutSecret } from "./config";

const cookieName = "toca_checkout_test";
const lifetime = 60 * 60 * 24;
export type CheckoutSession = { id: string; plan: PlanId; quantity: number; origin: string; expires: number };
function signature(value: string) {
  const secret = checkoutSecret("CHECKOUT_SESSION_SECRET");
  if (secret.length < 32) throw new CheckoutError("CHECKOUT_SESSION_SECRET debe tener al menos 32 caracteres aleatorios.", 503);
  return createHmac("sha256", secret).update(value).digest("hex");
}
export async function readSession(origin: string): Promise<CheckoutSession | null> {
  const raw = (await cookies()).get(cookieName)?.value;
  if (!raw) return null;
  const [payload, supplied, extra] = raw.split(".");
  if (extra || !payload || !/^[a-f0-9]{64}$/.test(supplied ?? "")) throw new CheckoutError("Sesión de compra inválida.", 403);
  if (!timingSafeEqual(Buffer.from(signature(payload), "hex"), Buffer.from(supplied, "hex"))) throw new CheckoutError("Sesión de compra inválida.", 403);
  let session: CheckoutSession;
  try { session = JSON.parse(Buffer.from(payload, "base64url").toString()); }
  catch { throw new CheckoutError("Sesión de compra inválida.", 403); }
  // Las cookies firmadas anteriores al selector corresponden a un NFC.
  if (session.quantity === undefined) session.quantity = 1;
  if (!isPlan(session.plan) || !isNfcQuantity(session.quantity) || !/^[a-f0-9-]{36}$/.test(session.id) || session.origin !== origin || !Number.isFinite(session.expires)) {
    throw new CheckoutError("Sesión de compra inválida.", 403);
  }
  if (session.expires < Date.now()) throw new CheckoutError("La sesión de compra venció. Conserva la referencia y revisa la suscripción en Mercado Pago antes de repetirla.", 410);
  return session;
}
export async function newSession(plan: PlanId, quantity: number, origin: string) {
  const session: CheckoutSession = { id: randomUUID(), plan, quantity, origin, expires: Date.now() + lifetime * 1000 };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  (await cookies()).set(cookieName, `${payload}.${signature(payload)}`, {
    httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax", path: "/", maxAge: lifetime,
  });
  return session;
}
