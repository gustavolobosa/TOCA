import Link from "next/link";
import { notFound } from "next/navigation";

import { SubmitButton } from "@/components/submit-button";
import { requireAdmin } from "@/lib/auth";
import type { NfcLink } from "@/lib/types";

import { updateNfcLink } from "../../actions";

type EditLinkPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditLinkPage({ params, searchParams }: EditLinkPageProps) {
  const [{ id: rawId }, { error }, { supabase, user }] = await Promise.all([
    params,
    searchParams,
    requireAdmin(),
  ]);
  const id = Number(rawId);

  if (!Number.isSafeInteger(id) || id < 1) notFound();

  const { data } = await supabase
    .from("nfc_links")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!data) notFound();

  const link = data as NfcLink;
  const action = updateNfcLink.bind(null, id);

  return (
    <main className="form-page">
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
          <label>
            URL de destino
            <input defaultValue={link.destination_url} name="destination_url" required type="url" />
          </label>
          <div className="form-actions">
            <Link className="button button-secondary" href="/panel">Cancelar</Link>
            <SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton>
          </div>
        </form>
      </section>
    </main>
  );
}
