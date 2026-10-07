import Link from "next/link";

import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/auth";
import { getProfiles } from "@/lib/data";
import { DestinationFields } from "@/components/destination-fields";

import { createNfcLink } from "../actions";

type NewLinkPageProps = { searchParams: Promise<{ error?: string }> };

export default async function NewLinkPage({ searchParams }: NewLinkPageProps) {
  const [{ error }, , profiles] = await Promise.all([searchParams, requireAdmin(), getProfiles()]);

  return (
    <main className="form-page" id="main-content">
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
            <span id="owner-label">Propietario</span>
            <select aria-labelledby="owner-label" name="owner_id" required defaultValue=""><option value="" disabled>Elige un usuario activo</option>
              {profiles.filter(profile => profile.is_active).map(profile => <option key={profile.id} value={profile.id}>{profile.name} ({profile.email})</option>)}
            </select>
          </label>
          <DestinationFields />
          <div className="form-actions">
            <Link className="button button-secondary" href="/panel">Cancelar</Link>
            <SubmitButton pendingLabel="Creando…">Crear enlace</SubmitButton>
          </div>
        </form>
      </section>
    </main>
  );
}
