"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { plans, pesos, isNfcQuantity, maxNfcQuantity, type PlanId } from "@/lib/pricing";
import type { CheckoutStatus } from "@/lib/checkout/mercadopago";
import styles from "./page.module.css";

export default function Checkout({ planId, resultPage = false }: { planId: PlanId; resultPage?: boolean }) {
  const lock = useRef(false);
  const [status, setStatus] = useState<CheckoutStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [quantityInput, setQuantityInput] = useState("1");
  const terminal = status && (["empty", "failed", "cancelled"].includes(status.state) ||
    ["approved", "rejected", "cancelled", "refunded", "charged_back"].includes(status.paymentStatus ?? ""));
  const active = status && ["creating", "ready"].includes(status.state);
  const plan = plans[(active || resultPage ? status?.plan : undefined) ?? planId];
  const quantity = active || resultPage ? status?.quantity ?? 1 : Number(quantityInput);
  const validQuantity = isNfcQuantity(quantity);
  const confirmedPlan = plans[status?.plan ?? planId];
  const confirmedQuantity = status?.quantity ?? 1;
  const paymentTitles: Record<string, string> = {
    approved: "Pago de prueba confirmado", rejected: "Pago rechazado",
    cancelled: "Pago cancelado", refunded: "Pago devuelto", charged_back: "Pago con contracargo",
  };

  useEffect(() => {
    if (busy || terminal) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let delay = 5000;
    async function poll() {
      if (document.hidden || !navigator.onLine) { timer = setTimeout(poll, delay); return; }
      try {
        const response = await fetch("/api/checkout", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]) });
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
  }, [busy, terminal]);

  async function send(action: "prepare" | "pay" | "cancel") {
    const response = await fetch("/api/checkout", {
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
    <p className="notice"><strong>Modo de prueba.</strong> Usa únicamente la cuenta y la tarjeta ficticias. Esta compra no activa un NFC ni genera un envío.</p>
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
        <div><dt>Precio sin IVA</dt><dd>{validQuantity ? pesos(plan.net * quantity) : "—"}</dd></div>
        <div><dt>IVA (19 %)</dt><dd>{validQuantity ? pesos(plan.vat * quantity) : "—"}</dd></div>
        <div><dt><strong>Total por {plan.period}</strong></dt><dd><strong>{validQuantity ? pesos(plan.total * quantity) : "—"}</strong></dd></div>
      </dl>
      <p>{plan.months === 12 ? "Pagas 10 meses y recibes 12. Cobro anual por adelantado, con renovación automática cada 12 meses." : "Cobro mensual con renovación automática."}</p>
      <p>Los datos de tu tarjeta y la autorización del cobro se ingresan en Mercado Pago.</p>
      {!resultPage && !active && <button className="button button-primary" disabled={busy || !status || !validQuantity} onClick={pay}>
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
      {resultPage && status?.state === "empty" && <p>No encontramos una compra en este navegador. Regresa desde el mismo navegador en el que comenzaste el pago.</p>}
      {status?.subscriptionId && <div className={status.paymentStatus === "approved" ? "notice success" : "notice"}>
        <h2>{paymentTitles[status.paymentStatus ?? ""] ?? (status.state === "cancelled" ? "Suscripción cancelada" : "Esperando confirmación del pago")}</h2>
        {status.paymentStatus === "approved" && <p>Mercado Pago confirmó {pesos(confirmedPlan.total * confirmedQuantity)} por {confirmedQuantity} NFC ({confirmedPlan.name.toLowerCase()}). Esta es una prueba: la activación del servicio se integrará en una etapa posterior.</p>}
        {status.state === "cancelled" && <p>La suscripción de prueba está cancelada y no tendrá nuevas renovaciones.</p>}
        {!terminal && <p>El resultado se actualiza automáticamente. Autorizar la suscripción no equivale a aprobar el pago.</p>}
        <small className={styles.reference}>Referencia: {status.reference}{status.paymentId && <><br />Pago: {status.paymentId}</>}</small>
      </div>}
      <div className={styles.actions}>
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
