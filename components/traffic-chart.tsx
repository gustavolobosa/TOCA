import { notFound } from "next/navigation";

import { requirePanelAccount } from "@/lib/auth";
import { destinationLabel, destinationOptions } from "@/lib/destinations";
import { statsStartDay } from "@/lib/format";
import type { EventDestinationType } from "@/lib/types";
import { parseId } from "@/lib/validation";
import { TrafficPlot, type TrafficSeries } from "@/components/traffic-plot";

type Filters = { nfc?: string | string[]; type?: string | string[]; days?: string | string[]; group?: string | string[] };
type ChartLink = { id: number; name: string; slug: string };
type DailyStat = { nfc_link_id: number; day: string; destination_type: EventDestinationType; visits: number };
const types: EventDestinationType[] = [...destinationOptions.map(option => option.value), "unknown"];
const numbers = new Intl.NumberFormat("es-CL");
const colors = ["#14213d", "#287eaa", "#c9463b", "#13795b", "#7756a8", "#65748b"];
const destinationColors: Record<EventDestinationType, string> = { instagram: "#c9463b", whatsapp: "#13795b", google_review: "#287eaa", generic: "#14213d", unknown: "#65748b" };

export async function TrafficChart({ filters }: { filters: Filters }) {
  const rawNfc = filters.nfc ?? "all", type = filters.type ?? "all", rawDays = filters.days ?? "30";
  const group = filters.group ?? "total";
  if (typeof rawNfc !== "string" || typeof type !== "string" || typeof rawDays !== "string" ||
      typeof group !== "string" || !["total", "nfc", "destination"].includes(group) ||
      !["7", "30", "90"].includes(rawDays) || (type !== "all" && !types.includes(type as EventDestinationType))) notFound();
  let nfc: number | null = null;
  try { if (rawNfc !== "all") nfc = parseId(rawNfc); } catch { notFound(); }
  const days = Number(rawDays);
  const now = new Date();
  const since = statsStartDay(now, days), today = statsStartDay(now, 1);
  const { supabase } = await requirePanelAccount();
  const links: ChartLink[] = [], stats: DailyStat[] = [];
  let loadError = false;
  try {
    // ponytail: límites explícitos del MVP; usar agregación SQL antes de superarlos, nunca mostrar totales truncados.
    let total = 1;
    while (links.length < total) {
      const result = await supabase.from("nfc_links").select("id,name,slug", { count: "exact" })
        .order("id").range(links.length, links.length + 499);
      if (result.error || result.count === null || result.count > 1000 || (!result.data?.length && result.count > links.length)) throw new Error("No se pudo cargar el gráfico.");
      total = result.count;
      links.push(...(result.data ?? []) as ChartLink[]);
    }
  } catch { loadError = true; }
  if (!loadError && nfc !== null && !links.some(link => link.id === nfc)) notFound();
  if (!loadError && links.length) {
    try {
      let total = 1;
      while (stats.length < total) {
        let query = supabase.from("nfc_daily_stats").select("nfc_link_id,day,destination_type,visits", { count: "exact" })
          .gte("day", since).lte("day", today)
          .order("nfc_link_id").order("day").order("destination_type");
        if (nfc !== null) query = query.eq("nfc_link_id", nfc);
        if (type !== "all") query = query.eq("destination_type", type);
        const result = await query.range(stats.length, stats.length + 499);
        if (result.error || result.count === null || result.count > 25000 || (!result.data?.length && result.count > stats.length)) throw new Error("No se pudo cargar el gráfico.");
        total = result.count;
        stats.push(...(result.data ?? []) as DailyStat[]);
      }
    } catch { loadError = true; }
  }

  const dates = Array.from({ length: days }, (_, index) => {
    const day = new Date(`${since}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
  const dayIndex = new Map(dates.map((day, index) => [day, index]));
  const rows = links.filter(link => nfc === null || link.id === nfc).map(link => ({ ...link, visits: 0 }));
  const byId = new Map(rows.map(row => [row.id, row]));
  for (const stat of stats) {
    const row = byId.get(stat.nfc_link_id);
    if (!row) continue;
    const visits = Number(stat.visits);
    if (!Number.isSafeInteger(visits) || visits < 0 || !types.includes(stat.destination_type) || !dayIndex.has(stat.day)) { loadError = true; break; }
    row.visits += visits;
  }
  rows.sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name, "es") || a.id - b.id);
  const total = rows.reduce((sum, row) => sum + row.visits, 0);
  const series: TrafficSeries[] = [];
  const hasOthers = group === "nfc" && rows.length > 6;
  const displayedLinks = hasOthers ? rows.slice(0, 5) : rows;
  if (group === "total") series.push({ id: "total", label: "Todas las visitas", color: colors[0], values: dates.map(() => 0) });
  if (group === "destination") {
    for (const kind of types.filter(kind => type === "all" || kind === type)) {
      series.push({ id: kind, label: destinationLabel(kind), color: destinationColors[kind], values: dates.map(() => 0) });
    }
  }
  if (group === "nfc") {
    displayedLinks.forEach((link, index) => series.push({ id: String(link.id), label: `${link.name} · ${link.slug}`, color: colors[index], values: dates.map(() => 0) }));
    if (hasOthers) series.push({ id: "others", label: `Otros NFC (${rows.length - 5})`, color: colors[5], values: dates.map(() => 0) });
  }
  const seriesById = new Map(series.map(item => [item.id, item]));
  if (!loadError) for (const stat of stats) {
    if (!byId.has(stat.nfc_link_id)) continue;
    const key = group === "total" ? "total" : group === "destination" ? stat.destination_type : seriesById.has(String(stat.nfc_link_id)) ? String(stat.nfc_link_id) : "others";
    const item = seriesById.get(key);
    if (item) item.values[dayIndex.get(stat.day)!] += Number(stat.visits);
  }
  const dayFormat = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "UTC" });

  return <section className="traffic-section" aria-labelledby="traffic-title" id="trafico">
    <div className="traffic-heading">
      <div><h2 id="traffic-title">Tráfico de tus NFC</h2><p>La evolución de tus visitas, día a día.</p></div>
      <p className="traffic-period">{dayFormat.format(new Date(`${since}T12:00:00Z`))} — {dayFormat.format(new Date(`${today}T12:00:00Z`))}<span>Hora de Chile</span></p>
    </div>
    <form action="/panel#trafico" method="get" className="traffic-filters">
      <div className="traffic-filter"><label htmlFor="traffic-nfc">NFC</label><select id="traffic-nfc" name="nfc" defaultValue={rawNfc}><option value="all">Todos los NFC</option>{links.map(link => <option value={link.id} key={link.id}>{link.name} · {link.slug}</option>)}</select></div>
      <div className="traffic-filter"><label htmlFor="traffic-type">Destino de la visita</label><select id="traffic-type" name="type" defaultValue={type}><option value="all">Todos los destinos</option>{types.map(kind => <option value={kind} key={kind}>{destinationLabel(kind)}</option>)}</select></div>
      <div className="traffic-filter"><label htmlFor="traffic-days">Período</label><select id="traffic-days" name="days" defaultValue={rawDays}>{[7, 30, 90].map(period => <option value={period} key={period}>Últimos {period} días</option>)}</select></div>
      <div className="traffic-filter"><label htmlFor="traffic-group">Agrupar por</label><select id="traffic-group" name="group" defaultValue={group}><option value="total">Total de visitas</option><option value="nfc">NFC</option><option value="destination">Tipo de destino</option></select></div>
      <button className="button button-secondary" type="submit">Aplicar filtros</button>
    </form>
    {loadError ? <p className="notice error" role="alert">No pudimos cargar el gráfico completo. Intenta de nuevo o selecciona un NFC y un período más corto.</p> : !links.length ?
      <div className="traffic-empty"><h3>Tu primera visita comienza aquí</h3><p>Cuando tengas un NFC asignado, podrás seguir sus visitas en este gráfico.</p></div> : <>
      <div className="traffic-summary"><p><strong>{numbers.format(total)}</strong> {total === 1 ? "visita" : "visitas"} en el período</p><span>{rows.length} {rows.length === 1 ? "NFC seleccionado" : "NFC seleccionados"}</span></div>
      {total === 0 && <p className="traffic-zero" role="status">No hay visitas para estos filtros. Prueba otro destino o un período más amplio.</p>}
      <TrafficPlot key={`${rawNfc}:${type}:${rawDays}:${group}:${since}`} dates={dates} series={series} />
      {hasOthers && <p className="traffic-hint">Se muestran los cinco NFC con más visitas y el resto se suma en “Otros NFC”. Filtra por un NFC para verlo individualmente.</p>}
      {group === "destination" && <p className="traffic-hint">El tipo corresponde al destino al momento de la visita, aunque lo hayas cambiado después.</p>}
    </>}
    <p className="traffic-note">Visitas son aperturas del enlace, no personas únicas, mensajes enviados ni reseñas publicadas.</p>
  </section>;
}
