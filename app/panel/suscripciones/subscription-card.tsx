"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { billingDate, billingState, type BillingDetail, type BillingPurchase } from "@/lib/billing";
import { plans, pesos } from "@/lib/pricing";
import { Icon } from "@/components/icon";
import styles from "./page.module.css";

const paymentLabels: Record<string, string> = {
  approved: "Aprobado", pending: "Pendiente", in_process: "En proceso", authorized: "Autorizado",
  rejected: "Rechazado", cancelled: "Cancelado", refunded: "Devuelto", charged_back: "Contracargo",
};

export function SubscriptionCard({ initial, now, index }: { initial: BillingPurchase; now: number; index: number }) {
  const [detail, setDetail] = useState<BillingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const cancelLock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const purchase = detail?.purchase ?? initial;
  const plan = plans[purchase.plan];
  const clock = detail ? Date.parse(detail.checkedAt) : now;
  const state = billingState(purchase, detail, clock);
  const cancelled = state.label === "Cancelada";
  const paid = !purchase.blocked && Boolean(purchase.paidUntil && Date.parse(purchase.paidUntil) > clock);
  const canCancel = !cancelled && purchase.state !== "failed" && (purchase.hasSubscription || Boolean(detail?.providerStatus));
  const endpoint = `/api/billing/${initial.id}`;

  const load = useCallback(async (page = 0) => {
    if (cancelLock.current || dialog.current?.open) return;
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    setLoading(true); setError("");
    try {
      const response = await fetch(`${endpoint}?page=${page}`, { cache: "no-store", signal: AbortSignal.any([current.signal, AbortSignal.timeout(55000)]) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No pudimos actualizar la suscripción.");
      if (!current.signal.aborted) setDetail(result);
    } catch (err) {
      if (!current.signal.aborted) setError(err instanceof Error ? err.message : "No pudimos actualizar la suscripción. Intenta nuevamente.");
    } finally { if (!current.signal.aborted) setLoading(false); }
  }, [endpoint]);

  useEffect(() => {
    // Escalonar las consultas evita abrir todos los pedidos al proveedor al mismo tiempo.
    const timer = setTimeout(() => { void load(); }, index * 800);
    return () => { clearTimeout(timer); controller.current?.abort(); };
  }, [load, index]);

  useEffect(() => {
    if (loading || cancelling || !detail || detail.purchase.state === "failed" || detail.purchase.state === "cancelled" || ["cancelled", "canceled", "paused"].includes(detail.providerStatus ?? "")) return;
    const waiting = !detail.purchase.fulfilled || detail.providerStatus === "pending" || Boolean(detail.warning);
    if (!waiting) return;
    const refreshVisible = () => { if (!document.hidden) void load(detail.paymentPage); };
    const timer = setTimeout(refreshVisible, 30000);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", refreshVisible); };
  }, [detail, loading, cancelling, load]);

  function openCancellation() {
    controller.current?.abort(); setLoading(false); setError("");
    dialog.current?.showModal();
  }
  async function cancel() {
    if (cancelLock.current) return;
    cancelLock.current = true; setCancelling(true); setError("");
    let confirmed = false;
    try {
      const response = await fetch(endpoint, { method: "POST", signal: AbortSignal.timeout(55000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No pudimos confirmar la cancelación.");
      setDetail(previous => ({ ...previous, ...result, warning: null, payments: previous?.payments ?? [], paymentCount: previous?.paymentCount ?? 0, paymentPage: previous?.paymentPage ?? 0 }));
      confirmed = true;
      setSuccess(true); dialog.current?.close();
    } catch (err) { setError(err instanceof Error ? err.message : "La cancelación no está confirmada. Cierra esta ventana y actualiza el estado antes de reintentar."); }
    finally { cancelLock.current = false; setCancelling(false); if (confirmed) void load(); }
  }

  return <article className={styles.card} aria-labelledby={`subscription-${purchase.id}`}>
    <div className={styles.cardTop}>
      <div className={styles.planIdentity}>
        <span className={styles.planIcon}><Icon name="nfc" /></span>
        <div><div className={styles.badges}>
          <span className={`${styles.badge} ${styles[state.tone]}`}>{state.label}</span>
          {purchase.mode === "test" && <span className={`${styles.badge} ${styles.neutral}`}>Prueba</span>}
        </div><h2 id={`subscription-${purchase.id}`}>{plan.name} <span>para {purchase.quantity} NFC</span></h2></div>
      </div>
      <div className={styles.price}><strong>{pesos(purchase.totalAmount)}</strong><span>por {plan.period}, IVA incluido</span></div>
    </div>
    {purchase.promoCode && <p className={styles.promotion}><Icon name="tag" /><strong>{purchase.promoCode}</strong><span>{pesos(purchase.unitNet ?? 0)} + IVA por NFC/mes durante toda la suscripción.</span></p>}
    <dl className={styles.facts}>
      <div><dt>Próximo cobro</dt><dd>{cancelled ? "Sin nuevas renovaciones" : detail?.providerStatus === "paused" ? "Renovación pausada" : detail?.nextPaymentDate ? billingDate(detail.nextPaymentDate) : loading ? "Consultando…" : "Por confirmar"}</dd></div>
      <div><dt>{cancelled ? "Acceso pagado hasta" : "Período pagado hasta"}</dt><dd>{purchase.mode === "test" ? "Suscripción de prueba" : purchase.paidUntil ? billingDate(purchase.paidUntil) : "Sin pago confirmado"}</dd></div>
      <div><dt>Fecha de contratación</dt><dd>{billingDate(purchase.createdAt)}</dd></div>
    </dl>
    {purchase.blocked && <p className={styles.warning}>El servicio está suspendido por un contracargo.</p>}
    {cancelled && <p className={styles.note}>{paid ? `La renovación está cancelada. Conservas el período pagado hasta el ${billingDate(purchase.paidUntil)}.` : "La renovación está cancelada."} Cancelar no devuelve los cobros anteriores.</p>}
    {success && <p className={styles.success} role="status">Renovación cancelada correctamente.</p>}
    {detail?.warning && <p className={styles.warning} role="status">{detail.warning}</p>}
    {error && <p className={styles.warning} role="alert">{error}</p>}
    <div className={styles.cardActions}>
      <Link href={`/comprar/resultado/${purchase.id}`} className={styles.detailLink}>{purchase.fulfilled ? "Ver compra y NFC" : cancelled || purchase.state === "failed" ? "Ver detalle de la compra" : "Ver compra y completar pago"}<Icon name="chevron" /></Link>
      <div>
        <button className={styles.refresh} onClick={() => void load(detail?.paymentPage ?? 0)} disabled={loading || cancelling}>{loading ? "Actualizando…" : "Actualizar estado"}</button>
        {canCancel && <button className={styles.cancel} onClick={openCancellation} disabled={cancelling}>Cancelar renovación</button>}
      </div>
    </div>
    <details className={styles.history}>
      <summary>Historial de pagos <span>{detail ? `${detail.paymentCount} registros` : ""}</span><Icon name="chevron" /></summary>
      {purchase.mode === "test" ? <p className={styles.note}>Esta es una compra de prueba. Consulta su pago en el detalle de la compra.</p> : !detail ?
        <p className={styles.note}>{loading ? "Cargando los pagos registrados…" : "No pudimos cargar el historial. Usa Actualizar estado para reintentar."}</p> : <>
        {!detail.payments.length ? <p className={styles.note}>Todavía no hay cobros registrados en esta página.</p> : <div className={styles.tableWrap}>
          <table><caption className={styles.srOnly}>Pagos de {plan.name}, {purchase.quantity} NFC</caption><thead><tr><th>Período desde</th><th>Estado</th><th>Importe</th><th>Referencia</th></tr></thead>
            <tbody>{detail.payments.map(payment => <tr key={payment.payment_id}>
              <td>{billingDate(payment.period_start)}</td><td>{paymentLabels[payment.status] ?? "En revisión"}{payment.refunded_amount > 0 && <small>Devuelto: {pesos(payment.refunded_amount)}</small>}</td>
              <td>{pesos(purchase.totalAmount)}</td><td className={styles.paymentId}>{payment.payment_id}</td>
            </tr>)}</tbody></table>
        </div>}
        <div className={styles.historyFooter}><small>Importes con IVA. Se muestran los pagos registrados en TOCA.</small>
          <div>{detail.paymentPage > 0 && <button disabled={loading || cancelling} onClick={() => void load(detail.paymentPage - 1)}>Más recientes</button>}
            {(detail.paymentPage + 1) * 10 < detail.paymentCount && <button disabled={loading || cancelling} onClick={() => void load(detail.paymentPage + 1)}>Anteriores</button>}</div>
        </div>
      </>}
    </details>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={`cancel-title-${purchase.id}`} aria-describedby={`cancel-description-${purchase.id}`} onCancel={event => { if (cancelLock.current) event.preventDefault(); }} onClose={() => { if (!cancelLock.current) void load(); }}>
      <span className={styles.dialogIcon}><Icon name="card" /></span>
      <h2 id={`cancel-title-${purchase.id}`}>¿Cancelar la renovación?</h2>
      <p id={`cancel-description-${purchase.id}`}>{plan.name} para {purchase.quantity} NFC. Se detendrán las próximas renovaciones de {pesos(purchase.totalAmount)} por {plan.period}.</p>
      <p>{paid ? `Conservas el período pagado hasta el ${billingDate(purchase.paidUntil)}.` : "Si hay un período pagado vigente, se conserva hasta su vencimiento."} Esta acción no devuelve pagos. Los cobros que ya estén en proceso pueden completarse.</p>
      {purchase.promoCode && <p>El código {purchase.promoCode} no se recupera si ya se aprobó un pago.</p>}
      {error && <p className={styles.warning} role="alert">{error}</p>}
      <div className={styles.dialogActions}>
        <button className="button button-secondary" autoFocus disabled={cancelling} onClick={() => dialog.current?.close()}>Conservar suscripción</button>
        <button className={styles.confirmCancel} disabled={cancelling} onClick={() => void cancel()}>{cancelling ? "Cancelando…" : "Sí, cancelar renovación"}</button>
      </div>
    </dialog>
  </article>;
}
