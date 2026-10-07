import Link from "next/link";
import { notFound } from "next/navigation";

import { SubmitButton } from "@/components/submit-button";
import { getNfc } from "@/lib/data";
import { DestinationFields } from "@/components/destination-fields";

import { updateNfcLink } from "../../actions";

type EditLinkPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditLinkPage({ params, searchParams }: EditLinkPageProps) {
  const [{ id: rawId }, { error }] = await Promise.all([
    params,
    searchParams,
  ]);
  const id = Number(rawId);

  if (!Number.isSafeInteger(id) || id < 1) notFound();

  const link = await getNfc(id);
  const action = updateNfcLink.bind(null, id);

  return (
    <main className="form-page" id="main-content">
      <Link className="back-link" href="/panel">Volver al panel</Link>
      <div className="form-heading">
        <p className="section-kicker">Editar NFC</p>
        <h1>{link.name}</h1>
        <p className="muted">La URL grabada en la etiqueta no cambia; solo cambia el destino final.</p>
      </div>
      <section className="editor-card">
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <form action={action} className="form-stack">
          <label>
            Nombre del NFC
            <input defaultValue={link.name} maxLength={100} name="name" required />
          </label>
          {link.requires_configuration && <p className="notice">Este NFC fue reasignado. Configura un destino nuevo antes de activarlo.</p>}
          <DestinationFields type={link.destination_type} url={link.destination_url} />
          <label className="checkbox-label"><input type="checkbox" name="is_active" defaultChecked={link.is_active} />NFC activo</label>
          <div className="form-actions">
            <Link className="button button-secondary" href="/panel">Cancelar</Link>
            <SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton>
          </div>
        </form>
      </section>
    </main>
  );
}
