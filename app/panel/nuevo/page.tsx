import Link from "next/link";

import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/auth";

import { createNfcLink } from "../actions";

type NewLinkPageProps = { searchParams: Promise<{ error?: string }> };

export default async function NewLinkPage({ searchParams }: NewLinkPageProps) {
  const [{ error }] = await Promise.all([searchParams, requireAdmin()]);

  return (
    <main className="form-page">
      <Link className="back-link" href="/panel">Volver al panel</Link>
      <div className="form-heading">
        <p className="section-kicker">Nuevo NFC</p>
        <h1>Crea el enlace que irá en la etiqueta</h1>
        <p className="muted">Podrás cambiar el destino después sin reprogramar el NFC.</p>
      </div>
      <section className="editor-card">
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <form action={createNfcLink} className="form-stack">
          <label>
            Nombre del NFC
            <input autoFocus maxLength={100} name="name" placeholder="Ej: Mesa 1" required />
            <small>Usa un nombre físico fácil de reconocer.</small>
          </label>
          <label>
            URL de destino
            <input name="destination_url" placeholder="https://instagram.com/tu_perfil" required type="url" />
            <small>Debe comenzar con https://. Puede ser Instagram, TikTok, Google Maps u otro sitio.</small>
          </label>
          <div className="form-actions">
            <Link className="button button-secondary" href="/panel">Cancelar</Link>
            <SubmitButton pendingLabel="Creando…">Crear enlace</SubmitButton>
          </div>
        </form>
      </section>
    </main>
  );
}
