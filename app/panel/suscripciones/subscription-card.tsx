"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { billingDate, billingState, type BillingDetail, type BillingPurchase } from "@/lib/billing";
import { plans, pesos } from "@/lib/pricing";

import styles from "./page.module.css";

export function SubscriptionCard({ initial, now, index }: { initial: BillingPurchase; now: number; index: number }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [detail, setDetail] = useState<BillingDetail | null>(null);
  const [loading, setLoading] = useState(false);
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

  const load = useCallback(async () => {
    if (cancelLock.current) return;
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    setLoading(true); setError("");
    try {
      const response = await fetch(`${endpoint}?resumen=1`, { cache: "no-store", signal: AbortSignal.any([current.signal, AbortSignal.timeout(55000)]) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No pudimos actualizar la suscripción.");
      if (!current.signal.aborted) setDetail(result);
    } catch (err) {
      if (!current.signal.aborted) setError(err instanceof Error ? err.message : "No pudimos actualizar la suscripción. Intenta nuevamente.");
    } finally { if (!current.signal.aborted) setLoading(false); }
  }, [endpoint]);

  useEffect(() => {
    if (initial.state === "failed" || initial.state === "cancelled" || (initial.fulfilled && initial.renewalStatus)) return;
    // Los cobros ya conciliados se muestran desde el resumen guardado.

    const timer = setTimeout(() => { void load(); }, index * 800);
    return () => { clearTimeout(timer); controller.current?.abort(); };
  }, [load, index, initial.state, initial.fulfilled, initial.renewalStatus]);

  useEffect(() => {
    if (loading || cancelling || !detail || detail.purchase.state === "failed" || detail.purchase.state === "cancelled" || ["cancelled", "canceled", "paused"].includes(detail.providerStatus ?? "")) return;
    const waiting = !detail.purchase.fulfilled || detail.providerStatus === "pending" || Boolean(detail.warning);
    if (!waiting) return;
    const refreshVisible = () => { if (!document.hidden) void load(); };
    const timer = setTimeout(refreshVisible, 30000);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", refreshVisible); };
  }, [detail, loading, cancelling, load]);

  function manage() {
    setConfirm(false); setError("");
    if (purchase.state !== "failed" && purchase.state !== "cancelled") void load();
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
      setSuccess(true); dialog.current?.close(); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "La cancelación no está confirmada. Cierra esta ventana y actualiza el estado antes de reintentar."); }
    finally { cancelLock.current = false; setCancelling(false); if (confirmed) void load(); }
  }

  const nextDate = detail && !detail.warning ? detail.nextPaymentDate : purchase.nextPaymentDate;
  const renewalDate = !cancelled && nextDate && Date.parse(nextDate) >= clock ? billingDate(nextDate) : null;
  const description = cancelled && paid ? "Servicio hasta el " + billingDate(purchase.paidUntil)
    : cancelled ? "Sin próximas renovaciones" : renewalDate ? "Renueva el " + renewalDate
    : purchase.paidUntil ? "Período pagado hasta el " + billingDate(purchase.paidUntil)
    : purchase.mode === "test" ? "Compra de prueba" : "Próximo cobro por confirmar";
  return <article className={styles.card}>
    <div><h3>{plan.name} · {purchase.quantity} NFC</h3><p>{description}</p></div>
    <div className={styles.badges}><span className={`${styles.badge} ${styles[state.tone]}`}>{cancelled ? "Renovación cancelada" : state.label}</span>
      {purchase.mode === "test" && <span className={styles.badge}>Prueba</span>}</div>
    <div className={styles.price}>{pesos(purchase.totalAmount)} <small>/ {plan.period}</small></div>
    <button className={styles.link} onClick={manage}>Administrar</button>
    {success && <small role="status">Renovación cancelada correctamente.</small>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={`manage-${purchase.id}`}
      onCancel={e=>{if (cancelLock.current) e.preventDefault();}}>
      <button className={styles.close} disabled={cancelling} aria-label="Cerrar" onClick={()=>dialog.current?.close()}>×</button>
      <h2 id={`manage-${purchase.id}`}>{confirm ? "¿Cancelar la renovación?" : plan.name + " · " + purchase.quantity + " NFC"}</h2>
      {confirm ? <>
        <p>Se detendrán las próximas renovaciones de {pesos(purchase.totalAmount)} por {plan.period}.
          {paid ? " Conservas el servicio hasta el " + billingDate(purchase.paidUntil) + "." : " Se conserva cualquier período vigente."}</p>
        <p>Los cobros ya iniciados pueden completarse. Cancelar no devuelve pagos anteriores.</p>
        {purchase.promoCode && <p>Si ya usaste el código {purchase.promoCode}, seguirá registrado como utilizado.</p>}
        <div className={styles.dialogActions}><button className="button button-secondary" disabled={cancelling} onClick={()=>setConfirm(false)}>Conservar suscripción</button>
          <button className={styles.confirmCancel} disabled={cancelling} onClick={cancel}>{cancelling ? "Cancelando…" : "Confirmar cancelación"}</button></div>
      </> : <>
        <p className={styles.quote}>{pesos(purchase.totalAmount)} <small>/ {plan.period} · IVA incluido</small></p>
        <p>{description}</p>
        {purchase.promoCode && <p>Promoción aplicada · <b>{purchase.promoCode}</b></p>}
        {purchase.blocked && <p>Servicio suspendido por contracargo.</p>}
        {detail?.warning && <p role="status">{detail.warning}</p>}
        <div className={styles.management}>
          {purchase.mode === "production" && <Link className="button button-secondary" onClick={()=>dialog.current?.close()}
            href={`/panel/suscripciones?vista=pagos&compra=${purchase.id}`}>Ver pagos de esta suscripción</Link>}
          <Link href={`/comprar/resultado/${purchase.id}`}>{purchase.fulfilled || cancelled || purchase.state === "failed" ? "Ver detalle de la compra" : "Ver compra y completar pago"}</Link>
          {(error || detail?.warning || (!detail && !cancelled && purchase.state !== "failed")) && <button className={styles.link} disabled={loading} onClick={()=>void load()}>{loading ? "Actualizando…" : "Actualizar estado"}</button>}
          {canCancel && <button className={styles.cancel} onClick={()=>{ controller.current?.abort(); setLoading(false); setError(""); setConfirm(true); }}>Cancelar renovación</button>}
        </div>
      </>}
      {error && <p role="alert" className="form-error">{error}</p>}
    </dialog>
  </article>;
}
