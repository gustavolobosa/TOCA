"use client";

import { useState } from "react";
import { Icon } from "@/components/icon";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setError(false);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      setError(true);
    }
  }

  return (
    <div className="copy-control"><button className="copy-button" onClick={copy} type="button" aria-live="polite">
      <Icon name="copy" />{copied ? "Enlace copiado" : "Copiar enlace NFC"}
    </button>{error && <span className="copy-error" role="alert">No se pudo copiar. Abre el detalle para copiar el enlace NFC manualmente.</span>}</div>
  );
}
