import { isPlan, isNfcQuantity } from "./pricing";

export function authReturnPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/panel";
  const url = new URL(value, "https://toca.invalid");
  if (url.origin !== "https://toca.invalid") return "/panel";
  if (["/panel", "/cuenta/compras", "/comprar/resultado"].includes(url.pathname)) return url.pathname;
  if (/^\/comprar\/resultado\/[a-f0-9-]{36}$/.test(url.pathname)) return url.pathname;
  const plan = url.searchParams.get("plan");
  const quantity = Number(url.searchParams.get("cantidad") ?? 1);
  if (url.pathname === "/comprar" && isPlan(plan) && isNfcQuantity(quantity)) return `/comprar?plan=${plan}&cantidad=${quantity}`;
  return "/panel";
}
