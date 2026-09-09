import Link from "next/link";

import { CopyButton } from "@/components/copy-button";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getSiteUrl } from "@/lib/env";
import type { NfcLinkSummary } from "@/lib/types";

import { setNfcLinkActive } from "./actions";

type DashboardProps = {
  searchParams: Promise<{ created?: string; updated?: string; error?: string }>;
};

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const [{ created, updated, error: pageError }, { supabase }] = await Promise.all([
    searchParams,
    requireAdmin(),
  ]);
  const { data, error } = await supabase
    .from("nfc_link_summaries")
    .select("*")
    .order("created_at", { ascending: false });
  const links = (data ?? []) as NfcLinkSummary[];
  const siteUrl = getSiteUrl();

  return (
    <main className="panel-main">
      <section className="panel-heading">
        <div>
          <p className="section-kicker">Tus NFC</p>
          <h1>Enlaces activos en el mundo físico</h1>
          <p className="muted">Cada URL se programa una vez. El destino puede cambiar cuando quieras.</p>
        </div>
        <Link className="button button-primary" href="/panel/nuevo">Agregar NFC</Link>
      </section>

      {created ? <div className="notice success" role="status">Enlace creado. Ya puedes copiarlo a NFC Tools.</div> : null}
      {updated ? <div className="notice success" role="status">Cambios guardados.</div> : null}
      {pageError || error ? (
        <div className="notice error" role="alert">
          {pageError ?? "No pudimos cargar los enlaces. Revisa la conexión con Supabase."}
        </div>
      ) : null}

      {links.length === 0 && !error ? (
        <section className="empty-state">
          <div className="tap-rings" aria-hidden="true"><span /><span /><span /></div>
          <h2>Tu primer toque comienza aquí</h2>
          <p>Crea un enlace, cópialo a tu NFC con NFC Tools y acércale tu teléfono.</p>
          <Link className="button button-primary" href="/panel/nuevo">Crear primer enlace</Link>
        </section>
      ) : (
        <div className="link-list">
          {links.map((link) => {
            const tocaUrl = `${siteUrl}/t/${link.slug}`;
            const toggleAction = setNfcLinkActive.bind(null, link.id, !link.is_active);

            return (
              <article className={`link-row ${link.is_active ? "" : "is-paused"}`} key={link.id}>
                <div className="link-identity">
                  <span className={`status-light ${link.is_active ? "active" : ""}`} aria-hidden="true" />
                  <div>
                    <div className="link-name-line">
                      <h2>{link.name}</h2>
                      <span className="status-text">{link.is_active ? "Activo" : "Pausado"}</span>
                    </div>
                    <p className="destination" title={link.destination_url}>{link.destination_url}</p>
                  </div>
                </div>

                <div className="touch-stats">
                  <div><strong>{Number(link.total_taps)}</strong><span>visitas</span></div>
                  <div><strong className="date-value">{formatDate(link.last_touched_at)}</strong><span>último toque</span></div>
                </div>

                <div className="link-url">
                  <code>{tocaUrl}</code>
                  <CopyButton value={tocaUrl} />
                </div>

                <div className="row-actions">
                  <Link className="button button-secondary" href={`/panel/${link.id}/editar`}>Editar</Link>
                  <form action={toggleAction}>
                    <button className="text-button" type="submit">{link.is_active ? "Pausar" : "Activar"}</button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
