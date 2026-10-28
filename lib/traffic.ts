import "server-only";
import { notFound } from "next/navigation";
import { requirePanelAccount } from "@/lib/auth";
import { destinationLabel, destinationOptions } from "@/lib/destinations";
import { statsStartDay } from "@/lib/format";
import { parseId } from "@/lib/validation";
import type { EventDestinationType, NfcLinkSummary } from "@/lib/types";
import type { TrafficSeries } from "@/components/traffic-plot";

export type TrafficFilters = { nfc?: string | string[]; type?: string | string[]; days?: string | string[]; group?: string | string[] };
type DailyStat = { nfc_link_id: number; day: string; destination_type: EventDestinationType; visits: number };
const types: EventDestinationType[] = [...destinationOptions.map(option => option.value), "unknown"];
const colors = ["#2458d3", "#13795b", "#7851a9", "#a84d23", "#2c788c", "#66758a"];

export async function getTraffic(filters: TrafficFilters) {
  const nfc = filters.nfc ?? "all", type = filters.type ?? "all", days = filters.days ?? "30", group = filters.group ?? "total";
  if (typeof nfc !== "string" || typeof type !== "string" || typeof days !== "string" || typeof group !== "string" ||
      !["7", "30", "90"].includes(days) || !["total", "nfc", "destination"].includes(group) || (type !== "all" && !types.includes(type as EventDestinationType))) notFound();
  let id: number | null = null;
  try { if (nfc !== "all") id = parseId(nfc); } catch { notFound(); }
  const now = new Date(), since = statsStartDay(now, Number(days)), today = statsStartDay(now, 1);
  const dates = Array.from({ length: Number(days) }, (_, index) => {
    const day = new Date(`${since}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
  const { supabase } = await requirePanelAccount();
  const links: NfcLinkSummary[] = [], stats: DailyStat[] = [];
  let error = false;
  try {
    // shortcut: límites explícitos del MVP; pasar a agregación SQL antes de 1000 NFC o 25000 grupos diarios.
    let count = 1;
    while (links.length < count) {
      const result = await supabase.from("nfc_link_summaries").select("*", { count: "exact" })
        .order("id").range(links.length, links.length + 499);
      if (result.error || result.count === null || result.count > 1000 || (!result.data?.length && result.count > links.length)) throw new Error();
      count = result.count;
      links.push(...(result.data ?? []) as NfcLinkSummary[]);
    }
  } catch { error = true; }
  if (!error && id !== null && !links.some(link => link.id === id)) notFound();
  if (!error && links.length) {
    try {
      let count = 1;
      while (stats.length < count) {
        let query = supabase.from("nfc_daily_stats").select("nfc_link_id,day,destination_type,visits", { count: "exact" })
          .gte("day", since).lte("day", today).order("nfc_link_id").order("day").order("destination_type");
        if (id !== null) query = query.eq("nfc_link_id", id);
        if (type !== "all") query = query.eq("destination_type", type);
        const result = await query.range(stats.length, stats.length + 499);
        if (result.error || result.count === null || result.count > 25000 || (!result.data?.length && result.count > stats.length)) throw new Error();
        count = result.count;
        stats.push(...(result.data ?? []) as DailyStat[]);
      }
    } catch { error = true; }
  }
  const dayIndex = new Map(dates.map((day, index) => [day, index]));
  const allRows = links.filter(link => id === null || link.id === id).map(link => ({ ...link, visits: 0 }));
  const byId = new Map(allRows.map(link => [link.id, link]));
  for (const stat of stats) {
    const row = byId.get(stat.nfc_link_id);
    if (!row) continue;
    const value = Number(stat.visits);
    if (!Number.isSafeInteger(value) || value < 0 || !types.includes(stat.destination_type) || !dayIndex.has(stat.day)) { error = true; break; }
    row.visits += value;
  }
  // El destino se filtra por las visitas históricas, nunca por la URL actual del NFC.
  const rows = error ? [] : allRows.filter(row => type === "all" || row.visits > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "es") || a.id - b.id);
  const ranked = [...rows].sort((a, b) => b.visits - a.visits || a.id - b.id);
  const hasOthers = group === "nfc" && rows.length > 6;
  const displayed = hasOthers ? ranked.slice(0, 5) : ranked;
  const series: TrafficSeries[] = [];
  const uniqueName = (link: NfcLinkSummary) => links.filter(item => item.name === link.name).length > 1 ? `${link.name} · ${link.slug.slice(-4)}` : link.name;
  if (group === "total") series.push({ id: "total", label: "Todas las visitas", color: colors[0], values: dates.map(() => 0) });
  if (group === "nfc") {
    displayed.forEach((link, index) => series.push({ id: String(link.id), label: uniqueName(link), color: colors[index], values: dates.map(() => 0) }));
    if (hasOthers) series.push({ id: "others", label: `Otros NFC (${rows.length - 5})`, color: colors[5], values: dates.map(() => 0) });
  }
  if (group === "destination") {
    types.filter(kind => (type === "all" || kind === type) && stats.some(stat => stat.destination_type === kind && byId.has(stat.nfc_link_id)))
      .forEach(kind => series.push({ id: kind, label: destinationLabel(kind), color: colors[types.indexOf(kind)], values: dates.map(() => 0) }));
  }
  const bySeries = new Map(series.map(item => [item.id, item]));
  if (!error) for (const stat of stats) {
    if (!byId.has(stat.nfc_link_id)) continue;
    const key = group === "total" ? "total" : group === "destination" ? stat.destination_type : bySeries.has(String(stat.nfc_link_id)) ? String(stat.nfc_link_id) : "others";
    const item = bySeries.get(key);
    if (item) item.values[dayIndex.get(stat.day)!] += Number(stat.visits);
  }
  return { filters: { nfc, type, days, group }, links: links.map(link => ({ id: link.id, label: uniqueName(link) })), rows, dates, series, hasOthers,
    total: rows.reduce((sum, row) => sum + row.visits, 0), error, since, today };
}

export type TrafficData = Awaited<ReturnType<typeof getTraffic>>;
