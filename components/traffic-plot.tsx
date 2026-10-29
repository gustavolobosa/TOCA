"use client";

import { useEffect, useId, useRef, useState } from "react";

export type TrafficSeries = { id: string; label: string; color: string; values: number[] };

// Las fechas ISO ya representan días de Chile. Evitar Intl aquí: sus datos de
// idioma pueden diferir entre Node y el navegador durante la hidratación.
const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function formatDay(isoDay: string, full = false) {
  const [year, month, day] = isoDay.split("-");
  const name = months[Number(month) - 1];
  return full ? `${Number(day)} de ${name} de ${year}` : `${Number(day)} ${name.slice(0, 3)}`;
}
const formatCount = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export function TrafficPlot({ dates, series, title = "Visitas por día", compact = false }: { dates: string[]; series: TrafficSeries[]; title?: string; compact?: boolean }) {
  const detailId = useId();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [selected, setSelected] = useState(dates.length - 1);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const maximum = Math.max(1, ...series.flatMap(item => item.values));
  const divisions = compact ? 2 : 4;
  const step = Math.max(1, Math.ceil(maximum / divisions));
  const ceiling = step * divisions;
  const height = compact ? 144 : 240;
  const left = Math.max(32, formatCount(ceiling).length * 7 + 12), right = width - 12, top = compact ? 8 : 18, bottom = height - 34;
  const x = (index: number) => dates.length === 1 ? (left + right) / 2 : left + index * (right - left) / (dates.length - 1);
  const y = (value: number) => bottom - value * (bottom - top) / ceiling;
  const labelCount = Math.min(dates.length, width < 500 ? 3 : 5);
  const labels = labelCount === 1 ? [0] : Array.from({ length: labelCount }, (_, index) => Math.round(index * (dates.length - 1) / (labelCount - 1)));

  return <div className={`traffic-timeline${compact ? " traffic-timeline-compact" : ""}`}>
    <div className="traffic-chart-heading">
      <h2>{title}</h2>
      <p>{compact ? "Visitas / día" : <>Del {formatDay(dates[0])} al {formatDay(dates[dates.length - 1])}</>}</p>
    </div>
    <div ref={container} className="traffic-plot" role="group" tabIndex={0}
      aria-label={`${title}. Usa las flechas izquierda y derecha para consultar cada fecha.`}
      aria-describedby={detailId}
      onFocus={() => setActive(true)} onBlur={() => setActive(false)}
      onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        setActive(true);
        setSelected(index => event.key === "Home" ? 0 : event.key === "End" ? dates.length - 1 : Math.max(0, Math.min(dates.length - 1, index + (event.key === "ArrowRight" ? 1 : -1))));
      }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} aria-hidden="true"
        onPointerLeave={() => { if (document.activeElement !== container.current) setActive(false); }}
        onPointerMove={event => {
          if (event.pointerType !== "mouse") return;
          setActive(true);
          const bounds = event.currentTarget.getBoundingClientRect();
          setSelected(Math.max(0, Math.min(dates.length - 1, Math.round(((event.clientX - bounds.left) * width / bounds.width - left) / (right - left) * (dates.length - 1)))));
        }}
        onPointerDown={event => {
          setActive(true);
          const bounds = event.currentTarget.getBoundingClientRect();
          setSelected(Math.max(0, Math.min(dates.length - 1, Math.round(((event.clientX - bounds.left) * width / bounds.width - left) / (right - left) * (dates.length - 1)))));
        }}>
        {Array.from({ length: divisions + 1 }, (_, index) => <g key={index}>
          <line x1={left} x2={right} y1={y(index * step)} y2={y(index * step)} className="traffic-grid" />
          <text x={left - 10} y={y(index * step) + 4} textAnchor="end" className="traffic-axis">{formatCount(index * step)}</text>
        </g>)}
        {labels.map(index => <text key={index} x={x(index)} y={height - 6} textAnchor={dates.length === 1 ? "middle" : index === 0 ? "start" : index === dates.length - 1 ? "end" : "middle"} className="traffic-axis">{formatDay(dates[index])}</text>)}
        {active && <line x1={x(selected)} x2={x(selected)} y1={top} y2={bottom} className="traffic-cursor" />}
        {series.map((item, seriesIndex) => <g key={item.id}>
          {series.length === 1 && <polygon points={`${x(0)},${bottom} ${item.values.map((value, index) => `${x(index)},${y(value)}`).join(" ")} ${x(dates.length - 1)},${bottom}`} fill={item.color} fillOpacity="0.06" />}
          <polyline points={item.values.map((value, index) => `${x(index)},${y(value)}`).join(" ")}
            fill="none" stroke={item.color} strokeWidth={compact ? 1.8 : 2.5} strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray={seriesIndex % 3 === 1 ? "6 4" : seriesIndex % 3 === 2 ? "2 4" : undefined} />
          {item.values.map((value, index) => (value > 0 || dates.length === 1) && (!compact || index === dates.length - 1) && (!active || index !== selected) && <circle key={index} cx={x(index)} cy={y(value)} r={compact ? 2.5 : dates.length > 30 ? 2 : 3} fill={item.color} />)}
          {active && <circle cx={x(selected)} cy={y(item.values[selected])} r="4.5" fill="white" stroke={item.color} strokeWidth="2.5" />}
        </g>)}
      </svg>
    <div id={detailId} hidden={!active} className="traffic-day-detail" aria-live="polite" aria-atomic="true">
      <time dateTime={dates[selected]}>{formatDay(dates[selected], true)}</time>
      <ul>{series.map(item => <li key={item.id}><i className="traffic-color" style={{ background: item.color }} aria-hidden="true" />
        <span>{item.label}</span><strong>{formatCount(item.values[selected])} {item.values[selected] === 1 ? "visita" : "visitas"}</strong>
      </li>)}</ul>
    </div>
    </div>
    <div className="traffic-timeline-footer">
      {(series.length > 1 || compact) && <ul className="traffic-legend" aria-label="Series del gráfico">
        {series.map(item => <li key={item.id}>
          <i className="traffic-color" style={{ background: item.color }} aria-hidden="true" />
          <span>{item.label}</span><strong>{formatCount(item.values.reduce((sum, value) => sum + value, 0))}</strong>
        </li>)}
      </ul>}
    <details className="traffic-data">
      <summary>Ver datos diarios</summary>
      <div className="table-scroll"><table>
        <caption className="sr-only">{title}: datos diarios, hora de Chile</caption>
        <thead><tr><th scope="col">Fecha</th>{series.map(item => <th scope="col" key={item.id}>{item.label}</th>)}</tr></thead>
        <tbody>{dates.map((date, index) => <tr key={date}><th scope="row">{formatDay(date)}</th>{series.map(item => <td key={item.id}>{formatCount(item.values[index])}</td>)}</tr>)}</tbody>
      </table></div>
    </details>
    </div>
  </div>;
}
