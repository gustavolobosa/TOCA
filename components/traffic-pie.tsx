"use client";

import { useId, useState } from "react";
import type { TrafficData } from "@/lib/traffic";

const count = new Intl.NumberFormat("es-CL");
const percent = new Intl.NumberFormat("es-CL", { style: "percent", maximumFractionDigits: 1 });
const share = (visits: number, total: number) => visits / total < 0.001 ? "<0,1 %" : percent.format(visits / total);
const point = (angle: number) => `${100 + 90 * Math.sin(angle)},${100 - 90 * Math.cos(angle)}`;

export function TrafficPie({ distribution, total }: Pick<TrafficData, "distribution" | "total">) {
  const titleId = useId();
  const detailId = useId();
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const active = distribution.find(item => item.id === (hovered ?? selected));
  const slices = distribution.filter(item => total > 0 && item.visits > 0).map((item, index, items) => {
    const start = items.slice(0, index).reduce((sum, previous) => sum + previous.visits, 0) / total * Math.PI * 2;
    const end = start + item.visits / total * Math.PI * 2;
    return { ...item, path: `M100,100 L${point(start)} A90,90 0 ${end - start > Math.PI ? 1 : 0},1 ${point(end)} Z` };
  });

  return <section className="traffic-distribution" aria-labelledby={titleId}
    onPointerLeave={() => setHovered(null)}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setSelected(null); }}
    onKeyDown={event => { if (event.key === "Escape") { setSelected(null); setHovered(null); } }}>
    <div className="traffic-chart-heading">
      <h2 id={titleId}>Por destino</h2>
      <p>Distribución del mes</p>
    </div>
    <div className="traffic-pie-area">
      <svg className="traffic-pie" viewBox="0 0 200 200" role="img"
        aria-label={total > 0 ? `Distribución de ${count.format(total)} visitas. Consulta cada destino en la lista siguiente.` : "Sin visitas para mostrar."}
        onPointerLeave={() => setHovered(null)}>
        {total === 0 ? <circle cx="100" cy="100" r="90" className="traffic-pie-empty" /> : slices.map(item => {
          const props = {
            fill: item.color,
            className: `traffic-pie-slice${active && active.id !== item.id ? " is-muted" : ""}`,
            onPointerEnter: (event: React.PointerEvent<SVGElement>) => { if (event.pointerType === "mouse") setHovered(item.id); },
            onClick: () => setSelected(item.id),
          };
          return slices.length === 1 ? <circle key={item.id} cx="100" cy="100" r="90" {...props} /> : <path key={item.id} d={item.path} {...props} />;
        })}
      </svg>
      <div id={detailId} className="traffic-pie-detail" aria-live="polite" aria-atomic="true">
        <span>{active ? active.label : "Total del mes"}</span>
        <strong>{count.format(active ? active.visits : total)} <small>{(active ? active.visits : total) === 1 ? "visita" : "visitas"}</small></strong>
        <span>{active ? `${share(active.visits, total)} del total` : total > 0 ? "Todos los destinos" : "Sin visitas este mes"}</span>
      </div>
    </div>
    {total > 0 && <div className="traffic-distribution-table">
      <div className="traffic-distribution-columns" aria-hidden="true"><span>Destino</span><span>Visitas</span><span>%</span></div>
      <ul className="traffic-distribution-legend" aria-label="Detalle de la distribución">
        {slices.map(item => <li key={item.id}>
          <button type="button" className={active?.id === item.id ? "is-active" : undefined}
            aria-label={`${item.label}: ${count.format(item.visits)} visitas, ${share(item.visits, total)}`}
            aria-describedby={detailId}
            onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(item.id); }}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setSelected(item.id)} onClick={() => setSelected(item.id)}>
            <span className="traffic-destination-name"><i className="traffic-color" style={{ background: item.color }} aria-hidden="true" />{item.label}</span>
            <strong>{count.format(item.visits)}</strong>
            <span className="traffic-percentage">{share(item.visits, total)}</span>
          </button>
        </li>)}
      </ul>
    </div>}
  </section>;
}
