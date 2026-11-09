import "server-only";

export const testBuyerEmail = "test_user_8501473770136902242@testuser.com";
export const testSellerId = "3828192200";
export type CheckoutMode = "test" | "production";
export function checkoutMode(): CheckoutMode | null {
  const mode = process.env.TOCA_CHECKOUT_MODE;
  return mode === "test" || mode === "production" ? mode : null;
}

export function checkoutEnabled() {
  return checkoutMode() !== null;
}

export function sellerId(mode: CheckoutMode) {
  const id = mode === "test" ? testSellerId : checkoutSecret("MERCADOPAGO_SELLER_ID");
  if (!/^\d+$/.test(id) || (mode === "production" && id === testSellerId)) throw new CheckoutError("Configura el ID del vendedor real de Mercado Pago.", 503);
  return id;
}
export function webhookSecret(mode: CheckoutMode) {
  return checkoutSecret(mode === "test" ? "MERCADOPAGO_WEBHOOK_SECRET" : "MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET");
}

export class CheckoutError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function checkoutSecret(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new CheckoutError(`Falta configurar ${name} en este entorno.`, 503);
  return value;
}
export function checkoutOrigin(host: string | null) {
  if (!host) throw new CheckoutError("Compra no disponible en este entorno.", 404);
  if (process.env.NODE_ENV === "development" && !process.env.VERCEL && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return `http://${host}`;
  const allowed = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL];
  for (const name of ["CHECKOUT_BASE_URL", "NEXT_PUBLIC_SITE_URL"]) {
    const configured = process.env[name];
    if (!configured) continue;
    let url: URL;
    try { url = new URL(configured); }
    catch { throw new CheckoutError(`${name} debe ser un origen HTTPS sin rutas.`, 503); }
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new CheckoutError(`${name} debe ser un origen HTTPS sin rutas.`, 503);
    }
    allowed.push(url.host);
  }
  if (!allowed.includes(host) || !/^[a-zA-Z0-9.-]+$/.test(host)) throw new CheckoutError("Dominio de compra no permitido.", 403);
  return `https://${host}`;
}
