import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePanelAccount } from "@/lib/auth";
import { accountPayments, billingOverview, billingPurchases } from "@/lib/checkout/billing-store";
import { checkoutMode } from "@/lib/checkout/config";
import { billingDate, hasReceipt, paymentLabel } from "@/lib/billing";
import { pesos, plans } from "@/lib/pricing";
import { parsePage } from "@/lib/validation";
import { SubscriptionCard } from "./subscription-card";
import { BuyDialog } from "./buy-dialog";
import { ReceiptButton } from "./receipt-button";
import styles from "./page.module.css";

export const metadata = { title: "Mis suscripciones | TOCA" };
const base = "/panel/suscripciones";
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ page?: string; vista?: string; compra?: string }> }) {
  const { user } = await requirePanelAccount();
  const query = await searchParams;
  let page: number;
  try { page = parsePage(query.page); } catch { notFound(); }
  const history = query.vista === "pagos";
  const archived = query.vista === "anteriores";
  const filter = history ? query.compra : undefined;
  if (filter && !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(filter)) notFound();
  const [overview, list, ledger] = await Promise.all([billingOverview(user.id),
    history ? null : billingPurchases(user.id, page, archived), history ? accountPayments(user.id, page, filter) : null]);
  const count = ledger?.count ?? list?.count ?? 0;
  const pageUrl = (p: number) => base + `?page=${p}` + (history ? "&vista=pagos" : archived ? "&vista=anteriores" : "") + (filter ? "&compra="+filter : "");
  const mode = checkoutMode();
  return <main className={`panel-main ${styles.main}`} id="main-content">
    <header className={styles.heading}><h1>Mis suscripciones</h1>{mode && <BuyDialog mode={mode}/>}</header>
    <section className={styles.summary} aria-label="Resumen de suscripciones">
      <div><div className={styles.units}><b>{overview.nfc_count}</b> NFC con servicio</div><span>{overview.subscription_count} {overview.subscription_count === 1 ? "suscripción vigente" : "suscripciones vigentes"}</span></div>
      <div className={styles.next}><span>Próximo cobro</span><strong>{overview.uncertain ? "Por confirmar" : overview.next_at ? pesos(overview.next_amount!) : "Sin cobros programados"}</strong>
        {overview.next_at && !overview.uncertain && <span>{billingDate(overview.next_at)} · IVA incluido</span>}</div>
    </section>
    <nav className={styles.tabs} aria-label="Facturación"><Link aria-current={!history ? "page" : undefined} href={base}>Suscripciones</Link>
      <Link aria-current={history ? "page" : undefined} href={base+"?vista=pagos"}>Historial de pagos</Link></nav>
    <div className={styles.sectionHeading}><h2>{history ? filter ? "Pagos de esta suscripción" : "Historial de pagos" : archived ? "Compras anteriores" : "Tus suscripciones"}</h2>
      {filter ? <Link href={base+"?vista=pagos"}>Ver todos los pagos</Link> : <small>IVA incluido</small>}</div>
    {list && <div className={styles.list}>{list.purchases.map((purchase,index) => <SubscriptionCard key={purchase.id} initial={purchase} now={list.now} index={index} />)}</div>}
    {ledger && ledger.payments.length > 0 && <table className={styles.table}><thead><tr><th>Fecha</th><th>Suscripción</th><th>Estado</th><th>Monto</th><th><span className={styles.srOnly}>Comprobante</span></th></tr></thead>
      <tbody>{ledger.payments.map(p => <tr key={p.payment_id}><td>{billingDate(p.approved_at ?? p.period_start)}{!p.approved_at && <small>Inicio del período</small>}</td>
        <td>{plans[p.purchase.plan].name} · {p.purchase.quantity} NFC</td><td><span className={`${styles.badge} ${p.status === "approved" && !p.refunded_amount ? styles.green : styles.neutral}`}>{paymentLabel(p.status,p.refunded_amount)}</span>
          {p.refunded_amount > 0 && <small>Devuelto: {pesos(p.refunded_amount)}</small>}</td><td>{pesos(p.purchase.total_amount)}</td>
        <td>{hasReceipt(p.status) && <ReceiptButton purchaseId={p.purchase_id} paymentId={p.payment_id}/>}</td></tr>)}</tbody></table>}
    {!(list?.purchases.length || ledger?.payments.length) && <p className={styles.empty}>{page ? "No hay registros en esta página." : history ? "Aún no hay pagos reales registrados." : archived ? "No hay compras anteriores." : "Todavía no tienes suscripciones vigentes."}</p>}
    {list && (archived || list.archivedCount > 0) && <Link className={styles.archive} href={archived ? base : base+"?vista=anteriores"}>{archived ? "Volver a mis suscripciones" : "Ver compras anteriores (" + list.archivedCount + ")"}</Link>}
    {(count > 10 || page > 0) && <nav className={styles.pagination} aria-label="Paginación">{page > 0 && <Link href={pageUrl(page-1)}>Anterior</Link>}<span>Página {page+1}</span>{(page+1)*10<count && <Link href={pageUrl(page+1)}>Siguiente</Link>}</nav>}
  </main>;
}
