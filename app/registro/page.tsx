import { notFound, redirect } from "next/navigation";
import { getAccount } from "@/lib/auth";
import { authReturnPath } from "@/lib/auth-return";
import { checkoutEnabled } from "@/lib/checkout/config";
import { PublicHeader, PublicFooter } from "@/components/public-navigation";
import { RegistrationForm } from "./form";
import styles from "../comprar/page.module.css";

export const metadata = { title: "Crear cuenta | TOCA", robots: { index: false, follow: false } };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!checkoutEnabled()) notFound();
  const next = authReturnPath((await searchParams).next);
  const account = await getAccount();
  if (account?.profile.is_active) redirect(next);
  return <><PublicHeader /><main id="contenido" className={styles.main}><section className="editor-card">
    <h1>Crea tu cuenta en TOCA</h1><RegistrationForm next={next} />
  </section></main><PublicFooter /></>;
}
