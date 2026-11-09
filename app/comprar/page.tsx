import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { PublicHeader, PublicFooter } from "@/components/public-navigation";
import { isPlan } from "@/lib/pricing";
import { checkoutEnabled, checkoutOrigin } from "@/lib/checkout/config";
import Checkout from "./checkout";
import styles from "./page.module.css";

export const metadata = { title: "Comprar TOCA", robots: { index: false, follow: false } };
export default async function BuyPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  if (!checkoutEnabled()) notFound();
  checkoutOrigin((await headers()).get("host"));
  const { plan } = await searchParams;
  if (!isPlan(plan)) notFound();
  return <><PublicHeader /><main id="contenido" className={styles.main}><h1>Confirma tu plan</h1><Checkout planId={plan} /></main><PublicFooter /></>;
}
