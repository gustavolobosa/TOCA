import { TrafficPlot } from "@/components/traffic-plot";
import { TrafficFilters } from "@/components/traffic-filters";
import { Icon } from "@/components/icon";
import { destinationLabel } from "@/lib/destinations";
import type { EventDestinationType } from "@/lib/types";
import type { TrafficData } from "@/lib/traffic";

export function TrafficChart({ data }: { data: TrafficData }) {
  const { filters, links, total, error } = data;
  return <section className="traffic-section" aria-labelledby="traffic-title" id="trafico">
    <TrafficFilters filters={filters} links={links}>
      <div className="traffic-summary">
        <p>{error ? "Visitas no disponibles" : <><strong>{new Intl.NumberFormat("es-CL").format(total)}</strong> {total === 1 ? "visita" : "visitas"}</>}</p>
        <details className="metric-help"><summary aria-label="Acerca de las visitas"><Icon name="info" /></summary>
          <div>Las visitas son aperturas del enlace, no personas únicas, mensajes ni reseñas.
            <p>Del {data.since} al {data.today}, según los días de Chile.</p>
            <p>Los filtros afectan al gráfico y al listado. El destino corresponde al momento de cada visita.</p>
          </div>
        </details>
      </div>
    </TrafficFilters>
    {error ? <p className="notice error" role="alert">No pudimos cargar los datos completos. Vuelve a intentarlo o selecciona un período más corto.</p> : !links.length ?
      <p className="traffic-empty">Cuando tengas un NFC, sus visitas aparecerán aquí.</p> : <>
      {filters.type !== "all" && <p className="filter-context">Visitas a {destinationLabel(filters.type as EventDestinationType)} en el período. Cada NFC muestra su destino actual.</p>}
      {total === 0 && <p className="traffic-zero" role="status">Sin visitas en este período para la selección actual.</p>}
      <TrafficPlot key={`${filters.nfc}:${filters.type}:${filters.days}:${filters.group}:${data.since}`} dates={data.dates} series={data.series} />
      {data.hasOthers && <p className="traffic-hint">Los cinco NFC con más visitas y el resto agrupado en «Otros NFC». Selecciona un NFC para verlo individualmente.</p>}
    </>}
  </section>;
}
