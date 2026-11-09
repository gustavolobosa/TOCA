"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { plans, pesos, isNfcQuantity, maxNfcQuantity, type PlanId } from "@/lib/pricing";
import type { CheckoutStatus } from "@/lib/checkout/mercadopago";
import styles from "./page.module.css";

export default function Checkout({ planId, resultPage = false, authenticated = true, initialQuantity = 1, purchaseId }: {
  planId: PlanId; resultPage?: boolean; authenticated?: boolean; initialQuantity?: number; purchaseId?: string;
}) {
  const lock = useRef(false);
  const [status, setStatus] = useState<CheckoutStatus | null>(authenticated ? null : { state: "empty" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [quantityInput, setQuantityInput] = useState(String(initialQuantity));
  const terminal = status && (["empty", "failed", "cancelled"].includes(status.state) ||
    (status.paymentStatus === "approved" && status.fulfilled) ||
    ["rejected", "cancelled", "refunded", "charged_back"].includes(status.paymentStatus ?? ""));
  const active = status && !status.fulfilled && ["creating", "ready"].includes(status.state);
  const plan = plans[(active || resultPage ? status?.plan : undefined) ?? planId];
  const quantity = active || resultPage ? status?.quantity ?? 1 : Number(quantityInput);
  const validQuantity = isNfcQuantity(quantity);
  const confirmedPlan = plans[status?.plan ?? planId];
  const confirmedQuantity = status?.quantity ?? 1;
  const total = (active || resultPage) && status?.totalAmount ? status.totalAmount : plan.total * quantity;
  const net = (active || resultPage) && status?.totalAmount ? Math.round(total / 1.19) : plan.net * quantity;
  const returnPath = `/comprar?plan=${planId}&cantidad=${validQuantity ? quantity : 1}`;
  const endpoint = purchaseId ? `/api/checkout?compra=${encodeURIComponent(purchaseId)}` : "/api/checkout";
  const paymentTitles: Record<string, string> = {
    approved: "Pago de prueba confirmado", rejected: "Pago rechazado",
    cancelled: "Pago cancelado", refunded: "Pago devuelto", charged_back: "Pago con contracargo",
  };

  useEffect(() => {
    if (!authenticated || busy || terminal) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let delay = 5000;
    async function poll() {
      if (document.hidden || !navigator.onLine) { timer = setTimeout(poll, delay); return; }
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]) });
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setError(data.error ?? "No pudimos consultar la compra.");
          if (response.status >= 400 && response.status < 500 && response.status !== 429) return;
          throw new Error("Consulta pendiente");
        }
        setStatus(data); setRetrying(false); setError("");
      } catch { if (controller.signal.aborted) return; setRetrying(true); }
      if (!controller.signal.aborted) { timer = setTimeout(poll, delay); delay = Math.min(delay * 1.5, 30000); }
    }
    timer = setTimeout(poll, 0);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [authenticated, busy, terminal, endpoint]);

  async function send(action: "prepare" | "pay" | "cancel") {
    const url = action === "cancel" && status?.purchaseId ? `/api/checkout?compra=${encodeURIComponent(status.purchaseId)}` : endpoint;
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(65000),
      body: JSON.stringify({ action, ...(action !== "cancel" ? { plan: planId, quantity: Number(quantityInput) } : {}) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "No pudimos completar la solicitud.");
    return data as CheckoutStatus;
  }
  async function pay() {
    if (lock.current || !isNfcQuantity(Number(quantityInput))) return;
    lock.current = true; setBusy(true); setError("");
    try {
      await send("prepare");
      setStatus({ state: "creating", plan: planId, quantity: Number(quantityInput) });
      const next = await send("pay");
      setStatus(next);
      if (next.checkoutUrl) window.location.assign(next.checkoutUrl);
    } catch (err) { setError(err instanceof Error ? err.message : "No pudimos abrir Mercado Pago."); }
    finally { lock.current = false; setBusy(false); }
  }
  async function cancel() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    setStatus(previous => ({ ...previous, state: "creating", paymentStatus: "pending" }));
    try { setStatus(await send("cancel")); }
    catch (err) { setError(err instanceof Error ? err.message : "No pudimos confirmar la cancelación."); }
    finally { lock.current = false; setBusy(false); }
  }

  return <>
    <p className="notice"><strong>Modo de prueba.</strong> En Mercado Pago usa el comprador y la tarjeta ficticios. Al aprobarse, se crearán los NFC de prueba en tu cuenta de TOCA. No se genera un envío.</p>
    {(!resultPage || status?.plan) && <section className="editor-card" aria-label="Resumen de compra">
      <h2>{plan.name}{validQuantity && <> · {quantity} NFC</>}</h2>
      {!resultPage && <div className={styles.quantity}>
        <label htmlFor="nfc-quantity">Cantidad de NFC</label>
        <input id="nfc-quantity" type="number" inputMode="numeric" min={1} max={maxNfcQuantity} step={1}
          value={active ? quantity : quantityInput} disabled={Boolean(active) || busy || !status}
          onChange={event => setQuantityInput(event.target.value)}
          aria-invalid={!validQuantity} aria-describedby="nfc-quantity-help" />
        <small id="nfc-quantity-help">De 1 a {maxNfcQuantity} NFC. {pesos(plan.total)} con IVA por NFC al {plan.period}.</small>
      </div>}
      {!validQuantity && <p className="form-error" role="alert">Ingresa una cantidad entera entre 1 y {maxNfcQuantity}.</p>}
      <dl className={styles.summary} aria-live="polite" aria-atomic="true">
        <div><dt>Precio sin IVA</dt><dd>{validQuantity ? pesos(net) : "—"}</dd></div>
        <div><dt>IVA (19 %)</dt><dd>{validQuantity ? pesos(total - net) : "—"}</dd></div>
        <div><dt><strong>Total por {plan.period}</strong></dt><dd><strong>{validQuantity ? pesos(total) : "—"}</strong></dd></div>
      </dl>
      <p>{plan.months === 12 ? "Pagas 10 meses y recibes 12. Cobro anual por adelantado, con renovación automática cada 12 meses." : "Cobro mensual con renovación automática."}</p>
      <p>Los datos de tu tarjeta y la autorización del cobro se ingresan en Mercado Pago.</p>
      {!authenticated && validQuantity && <div className={styles.actions}>
        <Link className="button button-primary" href={`/registro?next=${encodeURIComponent(returnPath)}`}>Crear cuenta y continuar</Link>
        <Link className="button button-secondary" href={`/ingresar?next=${encodeURIComponent(returnPath)}`}>Ya tengo cuenta</Link>
      </div>}
      {authenticated && !resultPage && !active && <button className="button button-primary" disabled={busy || !status || !validQuantity} onClick={pay}>
        {busy ? "Preparando compra…" : "Suscribirme con Mercado Pago"}
      </button>}
      {status?.checkoutUrl && status.subscriptionStatus === "pending" && !busy &&
        <a className="button button-primary" href={status.checkoutUrl} rel="noreferrer">Continuar en Mercado Pago</a>}
    </section>}
    <section aria-live="polite" className={styles.result}>
      {error && <p className="form-error" role="alert">{error}</p>}
      {retrying && <p>Reintentaremos la consulta automáticamente. No se generará otro cobro.</p>}
      {status?.state === "creating" && <p>Estamos verificando la creación del checkout. Espera el resultado antes de repetir la compra.</p>}
      {status?.state === "failed" && <p>No se creó la suscripción. Puedes iniciar otra prueba.</p>}
      {resultPage && status?.state === "empty" && <p>No encontramos una compra asociada a tu cuenta.</p>}
      {status?.subscriptionId && <div className={status.paymentStatus === "approved" ? "notice success" : "notice"}>
        <h2>{paymentTitles[status.paymentStatus ?? ""] ?? (status.state === "cancelled" ? "Suscripción cancelada" : "Esperando confirmación del pago")}</h2>
        {status.paymentStatus === "approved" && <p>Mercado Pago confirmó {pesos(status.totalAmount ?? confirmedPlan.total * confirmedQuantity)} por {confirmedQuantity} NFC ({confirmedPlan.name.toLowerCase()}).</p>}
        {status.fulfilled && <p><strong>Tus {confirmedQuantity} NFC están listos.</strong> Se asignaron a tu cuenta con destino inicial https://example.com. Puedes configurar sus nombres y destinos en el panel.</p>}
        {status.state === "cancelled" && <p>La suscripción de prueba está cancelada y no tendrá nuevas renovaciones.</p>}
        {!terminal && <p>El resultado se actualiza automáticamente. Autorizar la suscripción no equivale a aprobar el pago.</p>}
        <small className={styles.reference}>Referencia: {status.reference}{status.paymentId && <><br />Pago: {status.paymentId}</>}</small>
      </div>}
      <div className={styles.actions}>
        {status?.fulfilled && <Link className="button button-primary" href="/panel">Configurar mis NFC</Link>}
        {authenticated && <Link className="button button-secondary" href="/cuenta/compras">Mis compras</Link>}
        {status?.subscriptionId && status.state !== "cancelled" && <button className="button button-secondary" disabled={busy} onClick={cancel}>Cancelar suscripción de prueba</button>}
        <Link href="/precios" className="button button-secondary">Volver a los planes</Link>
      </div>
    </section>
    <details className={styles.testing}>
      <summary>Datos para probar el pago</summary>
      <p>Mastercard: <code>5416 7526 0258 2580</code><br />Vencimiento: <code>11/30</code> · CVV: <code>123</code><br />Titular: <code>APRO</code> · Documento: <strong>Otro</strong>, <code>123456789</code></p>
      <p>Correo: <code className={styles.reference}>test_user_8501473770136902242@testuser.com</code></p>
      <p>Puedes usar la sesión del comprador de prueba o pagar como invitado. No uses la cuenta del vendedor ni una cuenta real.</p>
    </details>
  </>;
}
