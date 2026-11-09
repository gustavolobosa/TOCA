import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { PublicHeader, PublicFooter } from "@/components/public-navigation";
import { isPlan, isNfcQuantity } from "@/lib/pricing";
import { getAccount } from "@/lib/auth";
import { checkoutEnabled, checkoutOrigin } from "@/lib/checkout/config";
import Checkout from "./checkout";
import styles from "./page.module.css";

export const metadata = { title: "Comprar TOCA", robots: { index: false, follow: false } };
export default async function BuyPage({ searchParams }: { searchParams: Promise<{ plan?: string; cantidad?: string }> }) {
  if (!checkoutEnabled()) notFound();
  checkoutOrigin((await headers()).get("host"));
  const { plan, cantidad } = await searchParams;
  const quantity = Number(cantidad ?? 1);
  if (!isPlan(plan) || !isNfcQuantity(quantity)) notFound();
  const account = await getAccount();
  return <><PublicHeader /><main id="contenido" className={styles.main}><h1>Confirma tu plan</h1><Checkout planId={plan} initialQuantity={quantity} authenticated={Boolean(account)} /></main><PublicFooter /></>;
}
