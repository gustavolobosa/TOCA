import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { PublicHeader, PublicFooter } from "@/components/public-navigation";
import { checkoutEnabled, checkoutOrigin } from "@/lib/checkout/config";
import Checkout from "../checkout";
import styles from "../page.module.css";

export const metadata = { title: "Resultado de tu compra | TOCA", robots: { index: false, follow: false } };
export default async function ResultPage() {
  if (!checkoutEnabled()) notFound();
  checkoutOrigin((await headers()).get("host"));
  if (!await getAccount()) redirect("/ingresar?next=%2Fcomprar%2Fresultado");
  return <><PublicHeader /><main id="contenido" className={styles.main}><h1>Resultado de tu compra</h1><Checkout planId="mensual" resultPage /></main><PublicFooter /></>;
}
