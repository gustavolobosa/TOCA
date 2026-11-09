import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PublicHeader, PublicFooter } from "@/components/public-navigation";
import { checkoutEnabled, checkoutOrigin } from "@/lib/checkout/config";
import { getAccount } from "@/lib/auth";
import { findAttempt, purchaseFromAttempt } from "@/lib/checkout/store";
import Checkout from "../../checkout";
import styles from "../../page.module.css";

export const metadata = { title: "Resultado de tu compra | TOCA", robots: { index: false, follow: false } };
export default async function PurchaseResult({ params }: { params: Promise<{ id: string }> }) {
  if (!checkoutEnabled()) notFound();
  checkoutOrigin((await headers()).get("host"));
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const account = await getAccount();
  if (!account) redirect(`/ingresar?next=${encodeURIComponent(`/comprar/resultado/${id}`)}`);
  const attempt = await findAttempt(id, account.user.id);
  if (!attempt) notFound();
  const purchase = purchaseFromAttempt(attempt);
  return <><PublicHeader /><main id="contenido" className={styles.main}><h1>Resultado de tu compra</h1>
    <Checkout planId={purchase.plan} initialQuantity={purchase.quantity} purchaseId={id} resultPage />
  </main><PublicFooter /></>;
}
