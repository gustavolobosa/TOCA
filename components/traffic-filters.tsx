"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { destinationOptions } from "@/lib/destinations";
import type { TrafficData } from "@/lib/traffic";

export function TrafficFilters({ filters, links, children }: Pick<TrafficData, "filters" | "links"> & { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function change(name: string, value: string) {
    const query = new URLSearchParams({ ...filters, [name]: value });
    startTransition(() => router.replace(`/panel?${query}`, { scroll: false }));
  }
  return <div aria-busy={pending}>
    <div className="traffic-heading">
      <h1 id="traffic-title">Actividad</h1>
      <form action="/panel" method="get" className="traffic-filters">
        <input type="hidden" name="group" value={filters.group} />
        <label><span className="sr-only">NFC</span><select aria-label="NFC" name="nfc" value={filters.nfc} disabled={pending} onChange={event => change("nfc", event.target.value)}>
          <option value="all">NFC: Todos</option>{links.map(link => <option key={link.id} value={link.id}>{link.label}</option>)}
        </select></label>
        <label><span className="sr-only">Destino de la visita</span><select aria-label="Destino de la visita" name="type" value={filters.type} disabled={pending} onChange={event => change("type", event.target.value)}>
          <option value="all">Destino: Todos</option>{destinationOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}<option value="unknown">Sin clasificar</option>
        </select></label>
        <label><span className="sr-only">Período</span><select aria-label="Período" name="days" value={filters.days} disabled={pending} onChange={event => change("days", event.target.value)}>
          {[7, 30, 90].map(days => <option key={days} value={days}>Últimos {days} días</option>)}
        </select></label>
        <noscript><button className="button button-secondary" type="submit">Aplicar filtros</button></noscript>
      </form>
    </div>
    <div className="traffic-toolbar">
      {children}
      <div className="segmented-control" role="group" aria-label="Agrupar por">
        {[["total", "Total"], ["nfc", "Por NFC"], ["destination", "Por destino"]].map(([value, label]) => <button key={value} type="button" aria-pressed={filters.group === value} disabled={pending} onClick={() => change("group", value)}>{label}</button>)}
      </div>
    </div>
    <span className="sr-only" role="status">{pending ? "Actualizando gráfico y NFC…" : ""}</span>
  </div>;
}
