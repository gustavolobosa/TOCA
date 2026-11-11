"use client";

import { useState } from "react";
import styles from "./page.module.css";

export function ReceiptButton({ purchaseId, paymentId }: { purchaseId: string; paymentId: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function download() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/billing/${purchaseId}/comprobante/${paymentId}`, { cache: "no-store" });
      if (!response.ok || !response.headers.get("Content-Type")?.startsWith("application/pdf")) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `TOCA-comprobante-${paymentId}.pdf`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch { setError("No pudimos descargarlo. Intenta nuevamente."); }
    finally { setBusy(false); }
  }
  return <><button className={styles.link} disabled={busy} onClick={download}>{busy ? "Descargando…" : "Descargar comprobante"}</button>
    {error && <small role="alert">{error}</small>}</>;
}
