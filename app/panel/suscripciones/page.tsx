import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePanelAccount } from "@/lib/auth";
import { billingPurchases } from "@/lib/checkout/billing-store";
import { parsePage } from "@/lib/validation";
import { Icon } from "@/components/icon";
import { SubscriptionCard } from "./subscription-card";
import styles from "./page.module.css";

export const metadata = { title: "Suscripciones y pagos | TOCA" };
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { user } = await requirePanelAccount();
  let page: number;
  try { page = parsePage((await searchParams).page); } catch { notFound(); }
  const { purchases, count, now } = await billingPurchases(user.id, page);
  return <main className={`panel-main ${styles.main}`} id="main-content">
    <header className={styles.heading}>
      <div><h1>Suscripciones y pagos</h1><p>Tus planes, próximas renovaciones e historial de cobros, en un solo lugar.</p></div>
      <Link className="button button-primary" href="/precios">Agregar NFC</Link>
    </header>
    <div className={styles.intro}><Icon name="card" /><p>Pagos gestionados por <strong>Mercado Pago</strong>. Puedes cancelar la renovación cuando quieras.</p></div>
    <div className={styles.sectionHeading}><h2>Tus suscripciones</h2><span>{count} {count === 1 ? "compra" : "compras"}</span></div>
    {purchases.length ? <div className={styles.list}>{purchases.map((purchase, index) => <SubscriptionCard key={purchase.id} initial={purchase} now={now} index={index} />)}</div> :
      <section className={styles.empty}><span><Icon name="nfc" /></span><h2>{count ? "No hay compras en esta página" : "Tus NFC empiezan aquí"}</h2>
        <p>{count ? "Vuelve a la primera página para ver tus suscripciones." : "Cuando contrates tu primer plan, aquí podrás consultar sus cobros y administrar la renovación."}</p>
        <Link className="button button-primary" href={count ? "/panel/suscripciones" : "/precios"}>{count ? "Ver mis suscripciones" : "Elegir un plan"}</Link>
      </section>}
    {count > 10 && <nav className={styles.pagination} aria-label="Páginas de suscripciones">
      {page > 0 && <Link href={`/panel/suscripciones?page=${page - 1}`}>Anterior</Link>}
      <span>Página {page + 1} de {Math.ceil(count / 10)}</span>
      {(page + 1) * 10 < count && <Link href={`/panel/suscripciones?page=${page + 1}`}>Siguiente</Link>}
    </nav>}
    <footer className={styles.footer}><Icon name="info" /><p>Cancelar una renovación conserva el período ya pagado. Los NFC mantienen su configuración y requieren un período vigente para funcionar.</p></footer>
  </main>;
}
