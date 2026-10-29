---
version: 1
slug: "app-precios-page-tsx"
primary_target: "app/precios/page.tsx"
related_targets: ["app/precios/page.module.css", "components/public-navigation.tsx", "lib/whatsapp.ts"]
---

# Precios de TOCA

Modo: Persuade. Ruta: `/precios`. Extensión de la identidad de la landing aprobada.

Audiencia: comercios que eligen pago mensual o anual por NFC y contactan por WhatsApp.

Contenido confirmado: $1.300 + IVA al mes; $13.000 + IVA al año en un pago, 12 meses por el precio de 10. Ambos planes incluyen el mismo servicio, soporte acrílico, un diseño disponible y configuración inicial. Tamaños S: 8 × 8 cm, M: 12 × 12 cm y L: 11 × 14 cm, al mismo precio. Atención los 7 días, de 09:00 a 18:00, hora de Chile; respuesta en menos de 24 horas. WhatsApp: 56951011687, configurable.

## Direction contract

THESIS: elegir periodicidad con precios completos a la vista; comparación corta sin tabla extensa, preguntas frecuentes ni planes adicionales.

OWN-WORLD: blanco, tinta azul, acción azul y azul muy claro para el anual; tipografía, botones y navegación heredados de la landing.

STORY: el visitante compara dos pagos por el mismo NFC, ve lo incluido y abre WhatsApp con el plan en el mensaje.

FIRST VIEWPORT: título alineado a la izquierda, dos columnas de precio, período/IVA explícitos y CTA por plan. Debajo, inclusiones y soporte en una sola sección compacta. En móvil, planes apilados.

FORM: implementación directa en código de una solicitud precisa con condiciones y estructura ya acordadas. Seed: no aplica, extensión acotada de la propuesta previa de precios; sin ronda de conceptos.

FINISH: revisión independiente completada con veredicto SHIP, sin bloqueos. Se conserva `DESIGN.md` y se documentan aquí las decisiones propias de la ruta. No hay nuevos recursos raster que requieran procedencia.

No hay nuevas imágenes; no se modifica la identidad global ni se agregan pagos en línea, envíos o condiciones no acordadas.

## Diseño aplicado a la ruta

Se reutilizan la cabecera y el pie públicos, la tipografía de sistema, los botones y los tokens globales de color. La escala editorial de la landing se mantiene: cuerpo de 16 px y título de 32–46 px, con precios tabulares destacados. La composición de precios ocupa hasta 1040 px, con dos columnas separadas por un borde y fondo azul suave en el plan anual; no introduce sombras ni una identidad nueva.

Hasta 640 px, los planes y la sección de inclusiones y soporte se apilan. Los botones ocupan el ancho de cada plan y tienen una altura mínima de 48 px. Estas decisiones pertenecen a `/precios` y no cambian las reglas del panel descritas en `DESIGN.md`.

## Cierre y evidencia

- Revisión visual independiente: SHIP, sin bloqueos, en escritorio de 1440 px y móvil de 320 px.
- Validación técnica informada por el agente principal: lint, TypeScript y build aprobados; `/precios` se genera como ruta estática.
- Enlaces de WhatsApp verificados hacia 56951011687, con mensajes específicos para cada plan.
- Identidad existente reutilizada; `PRODUCT.md` y `DESIGN.md` se conservan. Ampliar en el futuro la documentación global de las superficies públicas es opcional y queda fuera de esta extensión.
