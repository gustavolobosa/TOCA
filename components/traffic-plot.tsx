"use client";

import { useEffect, useRef, useState } from "react";

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

export function TrafficPlot({ dates, series }: { dates: string[]; series: TrafficSeries[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [selected, setSelected] = useState(dates.length - 1);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const left = 44, right = width - 16, top = 18, bottom = 236;
  const maximum = Math.max(1, ...series.flatMap(item => item.values));
  const step = Math.max(1, Math.ceil(maximum / 4));
  const ceiling = step * 4;
  const x = (index: number) => left + index * (right - left) / (dates.length - 1);
  const y = (value: number) => bottom - value * (bottom - top) / ceiling;
  const labelCount = width < 500 ? 3 : 5;
  const labels = Array.from({ length: labelCount }, (_, index) => Math.round(index * (dates.length - 1) / (labelCount - 1)));

  return <>
    <ul className="traffic-legend" aria-label="Series del gráfico">
      {series.map(item => <li key={item.id}>
        <i className="traffic-color" style={{ background: item.color }} aria-hidden="true" />
        <span>{item.label}</span><strong>{formatCount(item.values.reduce((sum, value) => sum + value, 0))}</strong>
      </li>)}
    </ul>
    <div ref={container} className="traffic-plot" role="group" tabIndex={0}
      aria-label="Visitas por día. Usa las flechas izquierda y derecha para consultar cada fecha."
      aria-describedby="traffic-day-detail"
      onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        setSelected(index => event.key === "Home" ? 0 : event.key === "End" ? dates.length - 1 : Math.max(0, Math.min(dates.length - 1, index + (event.key === "ArrowRight" ? 1 : -1))));
      }}>
      <svg viewBox={`0 0 ${width} 280`} width="100%" height="280" aria-hidden="true"
        onPointerMove={event => {
          if (event.pointerType !== "mouse") return;
          const bounds = event.currentTarget.getBoundingClientRect();
          setSelected(Math.max(0, Math.min(dates.length - 1, Math.round(((event.clientX - bounds.left) * width / bounds.width - left) / (right - left) * (dates.length - 1)))));
        }}
        onPointerDown={event => {
          const bounds = event.currentTarget.getBoundingClientRect();
          setSelected(Math.max(0, Math.min(dates.length - 1, Math.round(((event.clientX - bounds.left) * width / bounds.width - left) / (right - left) * (dates.length - 1)))));
        }}>
        {[0, 1, 2, 3, 4].map(index => <g key={index}>
          <line x1={left} x2={right} y1={y(index * step)} y2={y(index * step)} className="traffic-grid" />
          <text x={left - 10} y={y(index * step) + 4} textAnchor="end" className="traffic-axis">{formatCount(index * step)}</text>
        </g>)}
        {labels.map(index => <text key={index} x={x(index)} y={267} textAnchor={index === 0 ? "start" : index === dates.length - 1 ? "end" : "middle"} className="traffic-axis">{formatDay(dates[index])}</text>)}
        <line x1={x(selected)} x2={x(selected)} y1={top} y2={bottom} className="traffic-cursor" />
        {series.map((item, seriesIndex) => <g key={item.id}>
          <polyline points={item.values.map((value, index) => `${x(index)},${y(value)}`).join(" ")}
            fill="none" stroke={item.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
            strokeDasharray={seriesIndex % 3 === 1 ? "6 4" : seriesIndex % 3 === 2 ? "2 4" : undefined} />
          {item.values.map((value, index) => value > 0 && index !== selected && <circle key={index} cx={x(index)} cy={y(value)} r={dates.length > 30 ? 2 : 3} fill={item.color} />)}
          <circle cx={x(selected)} cy={y(item.values[selected])} r="4.5" fill="white" stroke={item.color} strokeWidth="2.5" />
        </g>)}
      </svg>
    </div>
    <div id="traffic-day-detail" className="traffic-day-detail" aria-live="polite" aria-atomic="true">
      <time dateTime={dates[selected]}>{formatDay(dates[selected], true)}</time>
      <ul>{series.map(item => <li key={item.id}><i className="traffic-color" style={{ background: item.color }} aria-hidden="true" />
        <span>{item.label}</span><strong>{formatCount(item.values[selected])} {item.values[selected] === 1 ? "visita" : "visitas"}</strong>
      </li>)}</ul>
    </div>
    <p className="traffic-hint">Pasa el cursor o toca el gráfico para consultar un día. También puedes usar las flechas del teclado.</p>
    <details className="traffic-data">
      <summary>Ver datos diarios</summary>
      <div className="table-scroll"><table>
        <caption className="sr-only">Visitas diarias de las series del gráfico, hora de Chile</caption>
        <thead><tr><th scope="col">Fecha</th>{series.map(item => <th scope="col" key={item.id}>{item.label}</th>)}</tr></thead>
        <tbody>{dates.map((date, index) => <tr key={date}><th scope="row">{formatDay(date)}</th>{series.map(item => <td key={item.id}>{formatCount(item.values[index])}</td>)}</tr>)}</tbody>
      </table></div>
    </details>
  </>;
}
