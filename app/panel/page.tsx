import Link from "next/link";

import { CopyButton } from "@/components/copy-button";
import { requirePanelAccount } from "@/lib/auth";
import { getProfiles } from "@/lib/data";
import { destinationLabel } from "@/lib/destinations";
import { parsePage } from "@/lib/validation";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { formatDate } from "@/lib/format";
import { getSiteUrl } from "@/lib/env";
import type { NfcLinkSummary } from "@/lib/types";

import { setNfcLinkActive } from "./actions";

type DashboardProps = {
  searchParams: Promise<{ created?: string; updated?: string; error?: string; page?: string }>;
};

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const [{ created, updated, error: pageError, page: rawPage }, { supabase, isAdmin }] = await Promise.all([
    searchParams,
    requirePanelAccount(),
  ]);
  let page: number;
  try { page = parsePage(rawPage); } catch { notFound(); }
  const { data, error, count } = await supabase
    .from("nfc_link_summaries")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(page * 50, page * 50 + 49);
  const owners = isAdmin ? await getProfiles() : [];
  const links = (data ?? []) as NfcLinkSummary[];
  const siteUrl = getSiteUrl();

  return (
    <main className="panel-main" id="main-content">
      <section className="panel-heading">
        <div>
          <h1>{isAdmin ? "Todos los NFC" : "Tus NFC"}</h1>
          <p className="muted">Cada URL se programa una vez. El destino puede cambiar cuando quieras.</p>
        </div>
        {isAdmin && <Link className="button button-primary" href="/panel/nuevo">Agregar NFC</Link>}
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
          <h2>{page ? "No hay NFC en esta página" : "Todavía no tienes NFC"}</h2>
          <p>{isAdmin ? "Crea un enlace y asígnalo a su propietario. Luego graba la URL fija con NFC Tools." : "El administrador debe asignarte una etiqueta para que puedas configurar su destino."}</p>
          {isAdmin && !page && <Link className="button button-primary" href="/panel/nuevo">Crear primer NFC</Link>}
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
                    <p className="muted destination-type">{destinationLabel(link.destination_type)}{isAdmin ? ` / ${owners.find(owner => owner.id === link.owner_id)?.name ?? "Sin perfil"}` : ""}</p>
                    {link.requires_configuration && <p className="muted">Destino nuevo pendiente</p>}
                  </div>
                </div>

                <div className="touch-stats">
                  <div><strong>{Number(link.total_taps)}</strong><span>visitas</span></div>
                  <div><strong className="date-value">{formatDate(link.last_touched_at)}</strong><span>última visita</span></div>
                </div>

                <div className="link-url">
                  <code>{tocaUrl}</code>
                  <CopyButton value={tocaUrl} />
                </div>

                <div className="row-actions">
                  <Link className="button button-secondary" href={`/panel/${link.id}/editar`}>Editar</Link>
                  <Link className="text-button" href={`/panel/${link.id}`}>Historial</Link>
                  <form action={toggleAction}>
                    <SubmitButton pendingLabel="Guardando…">{link.is_active ? "Pausar" : "Activar"}</SubmitButton>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <nav className="pagination" aria-label="Páginas de NFC">
        {page > 0 && <Link href={`/panel?page=${page - 1}`}>Anterior</Link>}
        {(page + 1) * 50 < (count ?? 0) && <Link href={`/panel?page=${page + 1}`}>Siguiente</Link>}
      </nav>
      <p className="muted metrics-note">Las visitas son aperturas registradas del enlace, no personas únicas, reseñas publicadas ni mensajes enviados.</p>
    </main>
  );
}
