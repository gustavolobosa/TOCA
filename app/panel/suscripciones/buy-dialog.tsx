"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { isNfcQuantity, maxNfcQuantity, pesos, plans, type PlanId } from "@/lib/pricing";
import styles from "./page.module.css";

async function checkout(action: "quote" | "prepare" | "pay", selection: object) {
  const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(65000), body: JSON.stringify({ action, ...selection }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "No pudimos completar la solicitud.");
  return result;
}

export function BuyDialog({ mode }: { mode: "test" | "production" }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [qty, setQty] = useState("1");
  const [plan, setPlan] = useState<PlanId>("mensual");
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<{ totalAmount: number; promoCode: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const quantity = Number(qty);
  const selection = { plan, quantity, promoCode: plan === "mensual" ? code.trim().toUpperCase() : "" };
  async function submit() {
    if (lock.current || !isNfcQuantity(quantity)) return;
    lock.current = true; setBusy(true); setError("");
    let preparedId: string | undefined;
    try {
      if (!quote) {
        const result = await checkout("quote", selection);
        setQuote({ totalAmount: result.totalAmount, promoCode: result.promoCode });
      } else {
        const confirmed = { ...selection, promoCode: quote.promoCode, expectedTotal: quote.totalAmount };
        preparedId = (await checkout("prepare", confirmed)).purchaseId;
        const result = await checkout("pay", confirmed);
        if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
        else router.push("/comprar/resultado/" + result.purchaseId);
      }
    } catch (err) {
      if (preparedId) router.push("/comprar/resultado/" + preparedId);
      else { setQuote(null); setError(err instanceof Error ? err.message : "No pudimos revisar la compra."); }
    } finally { lock.current = false; setBusy(false); }
  }
  function open() {
    setQuote(null); setError(""); setCode(""); setPlan("mensual"); setQty("1"); dialog.current?.showModal();
  }
  return <><button className="button button-primary" onClick={open}>Comprar más NFC</button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="buy-title" onCancel={e => { if (busy) e.preventDefault(); }}>
      <button className={styles.close} disabled={busy} aria-label="Cerrar" onClick={() => dialog.current?.close()}>×</button>
      <h2 id="buy-title">{quote ? "Revisa tu compra" : "Comprar más NFC"}</h2>
      <p>Esta compra crea una suscripción adicional con su propia renovación.</p>
      {mode === "test" && <p className="notice">Modo de prueba. Usa el comprador y la tarjeta de prueba.</p>}
      <form onSubmit={e => { e.preventDefault(); void submit(); }}>
        {quote ? <p>{plans[plan].name} · {quantity} NFC{quote.promoCode && <> · {quote.promoCode}</>}</p> : <>
          <div className={styles.inputs}><label>Cantidad de NFC<input type="number" min={1} max={maxNfcQuantity} required step={1} value={qty} disabled={busy} onChange={e=>setQty(e.target.value)}/></label>
            <label>Frecuencia<select value={plan} disabled={busy} onChange={e=>setPlan(e.target.value as PlanId)}><option value="mensual">Mensual</option><option value="anual">Anual</option></select></label></div>
          <p>{pesos(plans[plan].total)} con IVA por NFC al {plans[plan].period}.{plan === "anual" && " Pagas 10 meses y recibes 12."}</p>
          {plan === "mensual" && <details className={styles.promo}><summary>Ingresar código promocional</summary><label>Código<input maxLength={32} value={code} disabled={busy} onChange={e=>setCode(e.target.value)} autoCapitalize="characters" /></label></details>}
        </>}
        <p className={styles.quote}>{isNfcQuantity(quantity) ? pesos(quote?.totalAmount ?? plans[plan].total * quantity) : "—"} <small>/ {plans[plan].period} · IVA incluido</small></p>
        {!quote && selection.promoCode && <small>Al revisar tu compra verás el total con el código aplicado.</small>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className={styles.dialogActions}><button className="button button-primary" disabled={busy || !isNfcQuantity(quantity)}>{busy ? "Procesando…" : quote ? "Continuar a Mercado Pago" : "Revisar compra"}</button>
        {quote && <button type="button" className="button button-secondary" disabled={busy} onClick={()=>setQuote(null)}>Editar compra</button>}</div>
      </form>
    </dialog></>;
}
