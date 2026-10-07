import Link from "next/link";
import { notFound } from "next/navigation";
import { getNfc, getProfiles } from "@/lib/data";
import { requirePanelAccount } from "@/lib/auth";
import { destinationLabel } from "@/lib/destinations";
import { formatDate, statsStartDay } from "@/lib/format";
import { parseId, parsePage } from "@/lib/validation";
import type { DestinationHistory, EventDestinationType, RedirectEvent } from "@/lib/types";
import { reassignNfc } from "../actions";
import { SubmitButton } from "@/components/submit-button";

export default async function NfcHistoryPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ visits_page?: string; history_page?: string; error?: string; transferred?: string }>;
}) {
  const [{ id: rawId }, query, { supabase, isAdmin }] = await Promise.all([params, searchParams, requirePanelAccount()]);
  let id: number, visitsPage: number, historyPage: number;
  try { id = parseId(rawId); visitsPage = parsePage(query.visits_page); historyPage = parsePage(query.history_page); } catch { notFound(); }
  const link = await getNfc(id);
  const since = statsStartDay();
  const [visits, history, daily, profiles] = await Promise.all([
    supabase.from("redirect_events").select("id,nfc_link_id,destination_url,destination_type,created_at", { count: "exact" })
      .eq("nfc_link_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).range(visitsPage * 50, visitsPage * 50 + 49),
    supabase.from("nfc_destination_history").select("*").eq("nfc_link_id", id)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(historyPage * 50, historyPage * 50 + 50),
    supabase.from("nfc_daily_stats").select("day,destination_type,visits").eq("nfc_link_id", id).gte("day", since).order("day", { ascending: false }),
    isAdmin ? getProfiles() : Promise.resolve([]),
  ]);
  if (visits.error || history.error || daily.error) throw new Error("No pudimos cargar el historial. Vuelve a intentarlo.");
  const visitRows = (visits.data ?? []) as RedirectEvent[];
  const historyRows = (history.data ?? []) as DestinationHistory[];
  const dailyRows = (daily.data ?? []) as { day: string; destination_type: EventDestinationType; visits: number }[];
  const historyUrl = (v: number, h: number) => `/panel/${id}?visits_page=${v}&history_page=${h}`;
  return <main className="panel-main" id="main-content">
    <Link className="back-link" href="/panel">Volver al panel</Link>
    <section className="panel-heading"><div><h1>{link.name}</h1><p className="muted">{visits.count ?? 0} visitas registradas. El historial completo pertenece al propietario actual.</p></div>
      <Link className="button button-primary" href={`/panel/${id}/editar`}>Editar destino</Link></section>
    {query.error && <p className="form-error" role="alert">{query.error}</p>}
    {query.transferred && <p className="notice success" role="status">NFC reasignado y pausado. El nuevo propietario debe configurar su destino.</p>}
    <section className="history-section"><h2>Destinos anteriores</h2>
      <p className="muted">Incluye cambios sin visitas. Los datos anteriores al sistema multiusuario pueden estar incompletos y sin clasificar.</p>
      {historyRows.length ? <ul className="history-list">{historyRows.slice(0, 50).map(item => <li key={item.id}>
        <strong>{destinationLabel(item.destination_type)}</strong><time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
        <p className="url-wrap">{item.destination_url}</p>
      </li>)}</ul> : <p>Todavía no hay cambios de destino.</p>}
      <nav className="pagination" aria-label="Páginas de destinos">
        {historyPage > 0 && <Link href={historyUrl(visitsPage, historyPage - 1)}>Destinos anteriores</Link>}
        {historyRows.length > 50 && <Link href={historyUrl(visitsPage, historyPage + 1)}>Más destinos</Link>}
      </nav>
    </section>
    <section className="history-section"><h2>Visitas por día</h2><p className="muted">Últimos 30 días, hora de Chile, agrupados por el tipo de destino al momento de la visita.</p>
      {dailyRows.length ? <div className="table-scroll"><table><caption className="sr-only">Visitas diarias por tipo de destino</caption><thead><tr><th scope="col">Día</th><th scope="col">Destino</th><th scope="col">Visitas</th></tr></thead>
        <tbody>{dailyRows.map(row => <tr key={`${row.day}-${row.destination_type}`}><td>{row.day}</td><td>{destinationLabel(row.destination_type)}</td><td>{row.visits}</td></tr>)}</tbody></table></div> : <p>No hay visitas en los últimos 30 días.</p>}
    </section>
    <section className="history-section"><h2>Visitas registradas</h2>
      {visitRows.length ? <ul className="history-list">{visitRows.map(item => <li key={item.id}><strong>{destinationLabel(item.destination_type)}</strong>
        <time dateTime={item.created_at}>{formatDate(item.created_at)}</time><p className="url-wrap">{item.destination_url}</p></li>)}</ul> : <p>No hay visitas en esta página.</p>}
      <nav className="pagination" aria-label="Páginas de visitas">
        {visitsPage > 0 && <Link href={historyUrl(visitsPage - 1, historyPage)}>Visitas anteriores</Link>}
        {(visitsPage + 1) * 50 < (visits.count ?? 0) && <Link href={historyUrl(visitsPage + 1, historyPage)}>Más visitas</Link>}
      </nav>
    </section>
    {isAdmin && <section className="history-section"><h2>Reasignar propietario</h2>
      <p>Se transferirá todo el historial, incluidas las URLs anteriores. El propietario anterior perderá el acceso. La etiqueta conservará su URL fija y quedará pausada.</p>
      <form action={reassignNfc.bind(null, id)} className="form-stack">
        <label><span id="new-owner-label">Nuevo propietario</span><select aria-labelledby="new-owner-label" name="owner_id" required defaultValue=""><option value="" disabled>Elige otro usuario activo</option>
          {profiles.filter(profile => profile.is_active && profile.id !== link.owner_id).map(profile => <option key={profile.id} value={profile.id}>{profile.name} ({profile.email})</option>)}
        </select></label>
        <label className="checkbox-label"><input type="checkbox" name="confirm_transfer" required />Confirmo que se transferirá todo el historial al nuevo propietario.</label>
        <SubmitButton pendingLabel="Reasignando…">Reasignar y pausar NFC</SubmitButton>
      </form>
    </section>}
  </main>;
}
