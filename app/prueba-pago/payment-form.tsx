'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './payment-form.module.css';

type Result = {
  found: boolean; checkoutUrl?: string; subscriptionId?: string; subscriptionStatus?: string;
  paymentId?: number; paymentStatus?: string; paymentDetail?: string;
};
const storageKey = 'toca-local-checkout-attempt';

export default function PaymentForm({ buyerEmail }: { buyerEmail: string }) {
  const lock = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attempt, setAttempt] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [connectionError, setConnectionError] = useState(false);
  const settled = result?.subscriptionStatus === 'cancelled' ||
    ['approved', 'rejected', 'cancelled', 'refunded', 'charged_back'].includes(result?.paymentStatus ?? '');

  useEffect(() => {
    if (!submitted || !attempt || settled || busy) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let delay = 3000;

    async function poll() {
      if (document.hidden || !navigator.onLine) {
        timer = setTimeout(poll, delay);
        return;
      }
      try {
        const response = await fetch(`/prueba-pago/api?attempt=${attempt}`, {
          cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]),
        });
        if (!response.ok) throw new Error('No se pudo actualizar el pago.');
        const data = await response.json() as Result;
        if (controller.signal.aborted) return;
        setResult(data); setConnectionError(false);
        if (data.found) setError('');
      } catch {
        if (controller.signal.aborted) return;
        setConnectionError(true);
      }
      if (!controller.signal.aborted) {
        timer = setTimeout(poll, delay);
        delay = Math.min(delay * 1.5, 30000);
      }
    }

    timer = setTimeout(poll, 0);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [submitted, attempt, settled, busy]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const returned = new URL(window.location.href).searchParams.get('attempt');
      const saved = returned || sessionStorage.getItem(storageKey);
      const valid = saved && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(saved);
      setAttempt(valid ? saved : crypto.randomUUID());
      setSubmitted(!!valid);
      if (valid) sessionStorage.setItem(storageKey, saved);
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  async function request(method: string) {
    const response = await fetch(`/prueba-pago/api?attempt=${attempt}`, {
      method, headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    if (!response.ok) {
      if (data.retryAllowed) {
        sessionStorage.removeItem(storageKey); setAttempt(crypto.randomUUID()); setSubmitted(false);
      }
      throw new Error(data.error || 'No se pudo consultar la prueba.');
    }
    setResult(data as Result);
    return data as Result;
  }

  async function submit() {
    if (lock.current || submitted || !attempt) return;
    lock.current = true; setBusy(true); setError('');
    try {
      sessionStorage.setItem(storageKey, attempt);
      setSubmitted(true);
      const data = await request('POST');
      if (data.checkoutUrl) window.location.assign(data.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el checkout. Verificaremos el intento antes de repetirlo.');
    } finally { lock.current = false; setBusy(false); }
  }

  async function cancel() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await request('DELETE'); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo consultar la prueba.'); }
    finally { lock.current = false; setBusy(false); }
  }

  function reset() {
    sessionStorage.removeItem(storageKey); setAttempt(crypto.randomUUID());
    window.history.replaceState(null, '', window.location.pathname);
    setSubmitted(false); setResult(null); setError(''); setConnectionError(false);
  }

  return <>
    <div className="notice"><strong>Prueba en la página oficial de Mercado Pago</strong>
      <p>Puedes pagar con la sesión de tu comprador de prueba iniciada o elegir <strong>Sin cuenta de Mercado Pago → Tarjeta</strong>. No necesitas cerrar sesión ni usar incógnito.</p>
      <p>Con sesión iniciada, usa la Mastercard de prueba terminada en <strong>2580</strong> o agrega una nueva tarjeta. Si Mercado Pago solicita el código de seguridad, ingresa <code>123</code>.</p>
      <p>Usa solo esta Mastercard ficticia: <code>5416 7526 0258 2580</code><br />Vencimiento: <code>11/30</code> · CVV: <code>123</code> · Titular: <code>APRO</code><br />Documento: <strong>Otro</strong> · Número: <code>123456789</code></p>
      <p>Correo de prueba: <code className={styles.id}>{buyerEmail}</code>. No ingreses una tarjeta ni documentos reales.</p>
    </div>
    <section className="editor-card">
      <p>Ingresarás los datos de pago y autorizarás la suscripción en Mercado Pago. Al volver a TOCA, confirmaremos el resultado automáticamente.</p>
      {!submitted && <button type="button" className="button button-primary" disabled={!ready || busy || !attempt} onClick={submit}>
        {busy ? 'Abriendo Mercado Pago…' : 'Suscribirme con Mercado Pago · $2.618/mes'}
      </button>}
      {result?.checkoutUrl && result.subscriptionStatus === 'pending' && !settled &&
        <a className="button button-primary" href={result.checkoutUrl} rel="noreferrer">Continuar en Mercado Pago</a>}
    </section>
    <div aria-live="polite" className={styles.results}>
      {error && <p className="form-error" role="alert">{error}</p>}
      {submitted && <>
        <div className={styles.actions}>
          {result?.found && result.subscriptionStatus !== 'cancelled' &&
            <button type="button" className="button button-secondary" disabled={busy} onClick={cancel}>Cancelar suscripción de prueba</button>}
        </div>
        {!settled && <p role="status">{connectionError
          ? 'No pudimos actualizar el resultado. Reintentaremos automáticamente cuando haya conexión.'
          : 'Esperando la confirmación de Mercado Pago. El resultado se actualizará automáticamente.'}</p>}
        <small>Puedes volver a esta página en la misma pestaña: recuperaremos el resultado automáticamente, sin generar otro cobro.</small>
      </>}
      {result && (result.found ? <div className={result.paymentStatus === 'approved' ? 'notice success' : 'notice'}>
        <strong>{result.paymentStatus === 'approved' ? 'Pago de prueba aprobado' : result.paymentStatus === 'rejected' ? 'Pago de prueba rechazado' : result.subscriptionStatus === 'cancelled' ? 'Suscripción de prueba cancelada' : settled ? 'Pago de prueba finalizado' : 'Esperando confirmación del pago'}</strong>
        <p>Suscripción: {result.subscriptionStatus}<br />Pago: {result.paymentStatus}{result.paymentDetail ? ` (${result.paymentDetail})` : ''}</p>
        <small className={styles.id}>Suscripción: {result.subscriptionId}{result.paymentId && <><br />Pago: {result.paymentId}</>}</small>
        <p>Autorizar una suscripción no confirma el pago. Aquí se consulta el pago directamente en Mercado Pago.</p>
      </div> : <p className="notice">Todavía no aparece una suscripción para este intento. Seguiremos consultando automáticamente.</p>)}
      {submitted && (result?.subscriptionStatus === 'cancelled') &&
        <button type="button" className="button button-secondary" disabled={busy} onClick={reset}>Iniciar otra prueba</button>}
    </div>
  </>;
}
