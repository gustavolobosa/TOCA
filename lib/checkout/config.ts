import "server-only";

export const testBuyerEmail = "test_user_8501473770136902242@testuser.com";
export const testSellerId = "3828192200";

export function checkoutEnabled() {
  return process.env.TOCA_CHECKOUT_MODE === "test";
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
  if (!checkoutEnabled() || !host) throw new CheckoutError("Compra no disponible en este entorno.", 404);
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
