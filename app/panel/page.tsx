import Link from "next/link";
import { notFound } from "next/navigation";
import { TrafficChart } from "@/components/traffic-chart";
import { NfcRow } from "@/components/nfc-row";
import { requirePanelAccount } from "@/lib/auth";
import { getProfiles } from "@/lib/data";
import { getTraffic } from "@/lib/traffic";
import { parsePage } from "@/lib/validation";
import { getSiteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: {
  searchParams: Promise<{ created?: string; updated?: string; error?: string; page?: string }>;
}) {
  const [query, { isAdmin }] = await Promise.all([searchParams, requirePanelAccount()]);
  let page: number;
  try { page = parsePage(query.page); } catch { notFound(); }
  const [data, owners] = await Promise.all([getTraffic(), isAdmin ? getProfiles() : Promise.resolve([])]);
  const rows = data.rows.slice(page * 50, page * 50 + 50);
  const siteUrl = getSiteUrl();
  const pageUrl = (value: number) => `/panel?page=${value}`;
  return <main className="panel-main" id="main-content">
    <TrafficChart data={data} />
    <section className="nfc-section" aria-labelledby="nfc-title">
      <div className="panel-heading"><h2 id="nfc-title">NFC</h2>{isAdmin && <Link className="button button-primary" href="/panel/nuevo">Agregar NFC</Link>}</div>
      {query.created && <p className="notice success" role="status">Enlace creado. Ya puedes copiarlo a NFC Tools.</p>}
      {query.updated && <p className="notice success" role="status">Cambios guardados.</p>}
      {query.error && <p className="notice error" role="alert">{query.error}</p>}
      {!data.error && (rows.length ? <>
        <div className="nfc-columns" aria-hidden="true"><span>{isAdmin ? "Nombre / Propietario" : "Nombre"}</span><span>Destino actual</span><span>Visitas del mes</span><span>Estado</span><span /></div>
        <div className="link-list">{rows.map(link => <NfcRow key={link.id} link={link} owner={isAdmin ? owners.find(owner => owner.id === link.owner_id)?.name ?? "Sin perfil" : undefined} tocaUrl={`${siteUrl}/t/${link.slug}`} />)}</div>
      </> : <div className="empty-state"><h3>{data.linkCount === 0 ? "Todavía no tienes NFC" : "No hay NFC en esta página"}</h3>
        <p>{data.linkCount === 0 ? isAdmin ? "Agrega un NFC y asígnalo a su propietario." : "El administrador debe asignarte un NFC para comenzar." : "Vuelve a la primera página para ver tus NFC."}</p>
        {data.linkCount > 0 && <Link className="text-button" href="/panel">Ver primera página</Link>}
      </div>)}
      <nav className="pagination" aria-label="Páginas de NFC">
        {page > 0 && <Link href={pageUrl(page - 1)}>Anterior</Link>}
        {(page + 1) * 50 < data.rows.length && <Link href={pageUrl(page + 1)}>Siguiente</Link>}
      </nav>
    </section>
  </main>;
}
