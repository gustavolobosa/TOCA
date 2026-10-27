---
version: 1
slug: "app-panel-page-tsx"
primary_target: "app/panel/page.tsx"
related_targets: ["components/traffic-chart.tsx","components/traffic-plot.tsx","app/globals.css"]
---

# Panel: tráfico por NFC

Modo Operate. Extensión aprobada del panel existente; conservar marca, listado y acciones.

## Direction contract

THESIS: mostrar la evolución diaria de visitas en un único gráfico de puntos conectados por líneas, sin confundirlas con personas únicas ni conversiones.

OWN-WORLD: fondo blanco, tipografía Manrope y tinta azul de TOCA; colores planos por destino, sin sombras ni ornamentos nuevos.

STORY: elegir NFC, destino histórico y 7/30/90 días; agrupar por total, NFC o tipo de destino y consultar cada día con teclado, cursor o toque.

FIRST VIEWPORT: bloque de tráfico antes del listado; encabezado compacto, cuatro selectores y acción Aplicar; leyenda con totales y gráfico temporal. En móvil los filtros se apilan, se reducen las etiquetas de fechas y se conserva la altura del gráfico.

FORM: extensión local con SVG y un componente cliente pequeño para seleccionar fechas; tabla diaria desplegable como alternativa accesible. El usuario eligió expresamente puntos conectados por líneas. Sin nueva biblioteca de gráficos.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Límites: datos completos o error explícito; lecturas con sesión y RLS, sin service key; mantener el listado independiente de los filtros. No agregar tests persistentes ni modificar Supabase o Git.

## Documentación de la extensión

Esta entrega amplía una superficie existente: la mención genérica a DESIGN.md en FINISH no aplica a esta extensión local ni autoriza crear una identidad global. Se conserva PRODUCT.md; no se crea DESIGN.md ni .impeccable/design.json. El contraste con app/panel/page.tsx, components/traffic-chart.tsx y app/globals.css confirma Manrope, tinta --ink, superficie --white sobre el fondo --paper, borde --line y botón secundario existentes, sin nuevas sombras ni biblioteca.

- Los filtros se envían mediante GET a /panel#trafico con parámetros nfc, type, days y group. Por defecto: todos los NFC, todos los destinos, 30 días y total de visitas. La agrupación se conserva al paginar el listado, que mantiene su consulta independiente.
- El eje horizontal contiene días de calendario de Chile y el vertical visitas diarias, desde cero y con marcas enteras. Se completan los días sin visitas con cero. El detalle de un día funciona con cursor, toque y flechas/Home/End; la tabla desplegable contiene todos los valores representados.
- La agrupación por destino conserva el tipo histórico. Instagram (#c9463b), WhatsApp (#13795b), reseñas de Google (#287eaa), URL genérica (#14213d) y destino desconocido (#65748b) son roles locales. Las series NFC usan además violeta (#7756a8). Se combinan etiquetas, cifras y patrones de línea para no depender solo del color.
- Hasta seis NFC se muestran individualmente; con más se muestran los cinco con más visitas y una serie explícita Otros NFC. Esta serie suma el resto, incluidos los NFC de otras páginas; nunca se recorta el total. El filtro individual permite consultar cualquiera.
- La superficie mantiene Manrope, blanco y tinta azul de TOCA, sin sombras nuevas, gradientes ni animaciones. El gráfico ajusta su ancho con ResizeObserver; en móvil conserva texto y puntos legibles.
- La lectura autenticada mediante requirePanelAccount pagina resultados con cuenta exacta: máximo 1000 NFC y 25000 grupos diarios para el período y los filtros. Si falla la carga o se supera el límite, se muestra un error explícito; nunca totales recortados. Se usan tablas/vistas y RLS existentes, sin escrituras de Supabase ni Git.

Verificación de esta versión: lint y typecheck aprobados; 27 comprobaciones E2E existentes aprobadas con Supabase simulado y Next dev con Webpack en copia aislada. Revisión adicional con Playwright de total, agrupación NFC/destino, filtros combinados, 7/90 días, ceros, teclado, toque móvil, acceso de usuarios y filtro ajeno/agrupación inválida (404). Con 53 NFC y 79 visitas, el gráfico conserva las 79 visitas en seis series y al paginar. No se agregaron archivos de tests ni se escribieron datos en Supabase real.

La revisión visual actual se realizó a 1440px y 390px con datos sintéticos de siete días, sin errores JavaScript ni desbordamiento horizontal. Las capturas anteriores en .impeccable/review/traffic/ corresponden a las barras retiradas y no verifican esta versión. No hubo revalidación de RLS contra la base real; la evidencia simulada no demuestra el comportamiento de producción. El usuario informó que aplicó el SQL para retirar reassign_nfc; no se volvió a ejecutar.

No se identificó deriva del sistema en los archivos comparados. La ausencia previa de DESIGN.md se conserva y no se considera permiso para crear una marca.
