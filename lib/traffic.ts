import "server-only";
import { requirePanelAccount } from "@/lib/auth";
import { destinationLabel, destinationOptions } from "@/lib/destinations";
import { trafficMonthPeriod } from "@/lib/format";
import type { EventDestinationType, NfcLinkSummary } from "@/lib/types";
import type { TrafficSeries } from "@/components/traffic-plot";

type DailyStat = { nfc_link_id: number; day: string; destination_type: EventDestinationType; visits: number };
const types: EventDestinationType[] = [...destinationOptions.map(option => option.value), "unknown"];
const colors = ["#2458d3", "#13795b", "#7851a9", "#a84d23", "#2c788c", "#66758a"];

export async function getTraffic() {
  const period = trafficMonthPeriod();
  const { since, today, previousSince, previousUntil, comparisonUntil, dates } = period;
  const { supabase } = await requirePanelAccount();
  const links: NfcLinkSummary[] = [], stats: DailyStat[] = [];
  let error = false;
  try {
    // shortcut: límites del MVP; pasar a agregación SQL antes de 1000 NFC o 25000 grupos diarios.
    let count = 1;
    while (links.length < count) {
      const result = await supabase.from("nfc_link_summaries").select("*", { count: "exact" })
        .order("id").range(links.length, links.length + 499);
      if (result.error || result.count === null || result.count > 1000 || (!result.data?.length && result.count > links.length)) throw new Error();
      count = result.count;
      links.push(...(result.data ?? []) as NfcLinkSummary[]);
    }
    count = links.length ? 1 : 0;
    while (stats.length < count) {
      const result = await supabase.from("nfc_daily_stats").select("nfc_link_id,day,destination_type,visits", { count: "exact" })
        .gte("day", previousSince).lte("day", today).order("nfc_link_id").order("day").order("destination_type")
        .range(stats.length, stats.length + 499);
      if (result.error || result.count === null || result.count > 25000 || (!result.data?.length && result.count > stats.length)) throw new Error();
      count = result.count;
      stats.push(...(result.data ?? []) as DailyStat[]);
    }
  } catch { error = true; }

  const dayIndex = new Map(dates.map((day, index) => [day, index]));
  const allRows = links.map(link => ({ ...link, visits: 0 }));
  const byId = new Map(allRows.map(link => [link.id, link]));
  const monthlyStats: DailyStat[] = [];
  let total = 0, previousTotal = 0, comparisonTotal = 0;
  if (!error) for (const stat of stats) {
    const row = byId.get(stat.nfc_link_id);
    if (!row) continue;
    const value = Number(stat.visits);
    if (!Number.isSafeInteger(value) || value < 0 || !types.includes(stat.destination_type) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(stat.day) || stat.day < previousSince || stat.day > today) { error = true; break; }
    if (stat.day >= since) {
      if (!dayIndex.has(stat.day)) { error = true; break; }
      row.visits += value;
      total += value;
      if (stat.day <= comparisonUntil) comparisonTotal += value;
      monthlyStats.push(stat);
    } else if (stat.day <= previousUntil) previousTotal += value;
    if (![total, previousTotal, comparisonTotal].every(Number.isSafeInteger)) { error = true; break; }
  }
  const rows = error ? [] : allRows.sort((a, b) => a.name.localeCompare(b.name, "es") || a.id - b.id);
  const ranked = rows.filter(row => row.visits > 0).sort((a, b) => b.visits - a.visits || a.id - b.id);
  const hasOthers = ranked.length > 6;
  const displayed = hasOthers ? ranked.slice(0, 5) : ranked;
  const uniqueName = (link: NfcLinkSummary) => links.filter(item => item.name === link.name).length > 1 ? `${link.name} · ${link.slug.slice(-4)}` : link.name;
  const totalSeries: TrafficSeries[] = [{ id: "total", label: "Todas las visitas", color: colors[0], values: dates.map(() => 0) }];
  const nfcSeries: TrafficSeries[] = displayed.map((link, index) => ({ id: String(link.id), label: uniqueName(link), color: colors[index], values: dates.map(() => 0) }));
  if (hasOthers) nfcSeries.push({ id: "others", label: `Otros NFC (${ranked.length - 5})`, color: colors[5], values: dates.map(() => 0) });
  const destinationSeries: TrafficSeries[] = error ? [] : types.filter(kind => monthlyStats.some(stat => stat.destination_type === kind && Number(stat.visits) > 0))
    .map(kind => ({ id: kind, label: destinationLabel(kind), color: colors[types.indexOf(kind)], values: dates.map(() => 0) }));
  const byNfc = new Map(nfcSeries.map(item => [item.id, item]));
  const byDestination = new Map(destinationSeries.map(item => [item.id, item]));
  if (!error) for (const stat of monthlyStats) {
    const index = dayIndex.get(stat.day)!;
    const value = Number(stat.visits);
    totalSeries[0].values[index] += value;
    const nfc = byNfc.get(String(stat.nfc_link_id)) ?? byNfc.get("others");
    if (nfc) nfc.values[index] += value;
    const destination = byDestination.get(stat.destination_type);
    if (destination) destination.values[index] += value;
  }
  const distribution = destinationSeries.map(item => ({ id: item.id, label: item.label, color: item.color, visits: item.values.reduce((sum, value) => sum + value, 0) }));
  return { ...period, rows, totalSeries, nfcSeries, destinationSeries, distribution, hasOthers, error,
    linkCount: links.length, activeNfcCount: ranked.length, total: error ? 0 : total,
    variation: !error && previousTotal > 0 ? (comparisonTotal - previousTotal) / previousTotal : null };
}

export type TrafficData = Awaited<ReturnType<typeof getTraffic>>;
