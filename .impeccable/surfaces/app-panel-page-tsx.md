---
version: 1
slug: "app-panel-page-tsx"
primary_target: "app/panel/page.tsx"
related_targets: ["app/panel/layout.tsx", "components/nfc-row.tsx", "components/traffic-chart.tsx", "components/traffic-plot.tsx", "app/globals.css"]
---

# Panel TOCA: actividad y NFC

Rediseño aprobado expresamente el 27 de octubre de 2026. El usuario autorizó aplicar el diseño y probar administrador y usuarios con Playwright. Mantener TOCA, azul y blanco. Computador primero; web adaptable, sin crear una app móvil.

## Direction contract

THESIS: observar las visitas y administrar los NFC desde una sola superficie; detalle solo cuando se solicita.

OWN-WORLD: blanco #ffffff, azul #2458d3, texto #172b4d, superficie #f5f7fa, separadores #e1e7f0. Tipografía de sistema de trabajo, controles de 40–44 px, sin sombras decorativas ni indicadores de estado duplicados.

STORY: filtrar NFC, tipo histórico y 7/30/90 días; observar el gráfico y sus mismas cifras en las filas; desplegar destino e historial, copiar el enlace estable y cambiar estado desde el menú.

FIRST VIEWPORT: navegación lateral de 200 px, título Actividad y tres filtros arriba, total y agrupación debajo, gráfico de líneas con puntos de 220 px; listado compacto con destino actual, visitas del período, un estado y acciones. Admin ve propietario y creación; usuario solo sus NFC.

FORM: seed e0cbb847; el usuario eligió explícitamente combinar navegación lateral y detalle desplegable, prevaleciendo sobre la propuesta inicial. Componentes semánticos y SVG para datos, sin dependencias nuevas. Mockup aprobado: /Users/gustavolobos/.codex/generated_images/01a0878d-1bb1-7200-aa49-43f17429f451/exec-7696c3ef-8171-4c68-b9c6-6cedaba5e918.png. Aprobación textual: «apruebo el diseño, aplícalo y prueba tú mismo con Playwright».

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Comportamiento confirmado

- Los filtros afectan gráfico y listado; la agrupación solo cambia la representación del gráfico.
- Al filtrar Instagram, un NFC que actualmente apunta a WhatsApp sigue apareciendo si tuvo visitas a Instagram en el período. La columna dice Destino actual; el contexto del filtro aclara la atribución histórica.
- Sin filtro de tipo se conservan NFC con cero visitas para poder administrarlos. Al elegir un tipo se muestran los NFC con visitas históricas de ese tipo durante el período.
- Cada fila cuenta visitas del período y filtro. Total histórico en el detalle.
- Un único estado visible, pausa/activación dentro del menú y destino resumido. No mostrar última visita, URL completa ni identificadores técnicos en la fila.
- El historial se carga al abrirlo y presenta los últimos 20 registros con acceso al historial completo paginado. Lecturas con sesión y RLS, sin clave de servicio.
- La zona horaria de Chile sigue gobernando los días; su explicación está en la ayuda de visitas. Las fechas del componente cliente usan etiquetas deterministas para evitar errores de hidratación.
- Hasta seis series de NFC; con más, cinco principales y Otros NFC, sin omitir visitas fuera de la página actual.

## Alcance y evidencia

No se modifican esquema, políticas, datos reales, autenticación, permisos ni reasignación. No se ejecutan operaciones de escritura de Git. Pruebas con Next dev, Chrome/Playwright y Supabase simulado en memoria; la simulación no demuestra RLS en producción.

El mockup contiene datos ilustrativos; el código consulta datos reales de la sesión. No se envían imágenes del mockup al navegador: toda la interfaz es HTML/CSS y el gráfico es SVG. Capturas actuales en .impeccable/review/desktop.png, user-desktop.png y mobile.png; únicamente se oculta el indicador de herramientas de Next dev al capturar.
