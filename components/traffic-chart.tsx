import { TrafficPlot } from "@/components/traffic-plot";
import { TrafficPie } from "@/components/traffic-pie";
import { Icon } from "@/components/icon";
import type { TrafficData } from "@/lib/traffic";

const count = new Intl.NumberFormat("es-CL");
const percent = new Intl.NumberFormat("es-CL", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
const month = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" });
const date = (value: string) => new Date(`${value}T12:00:00Z`);

export function TrafficChart({ data }: { data: TrafficData }) {
  const { total, error, variation } = data;
  const comparisonDay = Number(data.comparisonUntil.slice(8));
  const todayDay = Number(data.today.slice(8));
  const previousMonth = new Intl.DateTimeFormat("es-CL", { month: "long", timeZone: "UTC" }).format(date(data.previousSince));
  return <section className="traffic-section" aria-labelledby="traffic-title" id="trafico">
    <div className="traffic-heading">
      <div><h1 id="traffic-title">Actividad</h1><p className="traffic-period">{month.format(date(data.since))} · al {shortDay.format(date(data.today))}</p></div>
      <details className="metric-help"><summary aria-label="Acerca de las estadísticas"><Icon name="info" /></summary>
        <div>Las visitas son aperturas del enlace, no personas únicas, mensajes ni reseñas.
          <p>Los días corresponden a Chile. Hoy está en curso; el período anterior contiene días completos.</p>
          <p>La variación compara del 1 al {comparisonDay} de ambos meses. Si el mes anterior es más corto, los días adicionales del actual quedan fuera de esa comparación.</p>
          <p>Los destinos corresponden al momento de cada visita. «NFC con visitas» cuenta etiquetas con actividad este mes, aunque actualmente estén pausadas.</p>
        </div>
      </details>
    </div>
    <dl className="traffic-metrics">
      <div><dt>Visitas del mes</dt><dd>{error ? "—" : count.format(total)}</dd><dd className="traffic-metric-note">{todayDay === 1 ? "Desde hoy, 1 de este mes" : `Del 1 al ${todayDay} de este mes`}</dd></div>
      <div><dt>Variación mensual</dt><dd>{error ? "—" : variation === null ? "—" : percent.format(Math.round(variation * 1000) / 1000)}</dd>
        <dd className="traffic-metric-note">{variation === null && !error ? "Sin comparación: mes anterior sin visitas" : `${comparisonDay === 1 ? "Día 1" : `Días 1–${comparisonDay}`} frente a ${previousMonth}`}</dd></div>
      <div><dt>NFC con visitas</dt><dd>{error ? "—" : count.format(data.activeNfcCount)}</dd><dd className="traffic-metric-note">{error ? "Total no disponible" : `${count.format(data.linkCount)} NFC en total`}</dd></div>
    </dl>
    {error ? <p className="notice error" role="alert">No pudimos cargar las estadísticas completas. Vuelve a cargar la página para intentarlo nuevamente.</p> : <>
      {data.linkCount === 0 ? <p className="traffic-zero" role="status">Cuando tengas un NFC, sus visitas aparecerán aquí.</p> : total === 0 && <p className="traffic-zero" role="status">Todavía no hay visitas este mes.</p>}
      <div className="traffic-charts">
        <div className="traffic-plots">
          <TrafficPlot key={`total:${data.today}`} title="Total de visitas" dates={data.dates} series={data.totalSeries} compact />
          <TrafficPlot key={`nfc:${data.today}`} title="Visitas por NFC" dates={data.dates} series={data.nfcSeries} compact />
          <TrafficPlot key={`destination:${data.today}`} title="Visitas por destino" dates={data.dates} series={data.destinationSeries} compact />
          {data.hasOthers && <p className="traffic-hint">Los cinco NFC con más visitas y el resto agrupado en «Otros NFC».</p>}
        </div>
        <TrafficPie distribution={data.distribution} total={total} />
      </div>
    </>}
  </section>;
}
