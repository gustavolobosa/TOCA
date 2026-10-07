"use client";

import { useState } from "react";

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
    <><button className="copy-button" onClick={copy} type="button" aria-live="polite">
      {copied ? "Copiado" : "Copiar"}
    </button>{error && <span role="alert">No se pudo copiar. Selecciona el texto y cópialo manualmente.</span>}</>
  );
}
