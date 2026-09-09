# TOCA - Notas de producto

## Concepto central

TOCA usa etiquetas NFC con una URL corta y dinámica, por ejemplo
`https://toca.cl/t/x7K2pQ`. Cada toque pasa primero por TOCA, se registra y luego
se redirige al destino configurado por el negocio.

Posicionamiento acordado: **TOCA es un enlace NFC dinámico y medible;
comercialmente se presenta mediante casos concretos.** El motor será genérico,
pero podrá presentarse a través de casos como reseñas, redes sociales, menús o
promociones.

Cada etiqueta se asocia a un negocio, una sucursal y un punto físico, como una
mesa, caja o recepción. El destino puede cambiarse sin volver a grabar la
etiqueta NFC.

## Google Reviews

- TOCA puede redirigir al formulario oficial de reseñas de Google.
- Google no permite preseleccionar ni publicar automáticamente cinco estrellas.
- TOCA puede medir toques y redirecciones, pero no atribuir con certeza una
  reseña de Google a una etiqueta o persona específica.
- Mediante Google Places se puede consultar el promedio y el total de reseñas.
- Mediante Google Business Profile, sujeto a autorización y aprobación de API,
  se pueden importar reseñas y calcular tendencias y distribución de estrellas.
- La conversión entre redirecciones y nuevas reseñas debe presentarse como una
  estimación, no como atribución exacta.

## Instagram y TikTok

- Una etiqueta puede redirigir a un perfil, publicación, reel o video.
- TOCA puede medir el toque, la etiqueta de origen y la redirección realizada.
- Instagram y TikTok deciden si abren su aplicación instalada o la versión web.
- TOCA no puede confirmar desde una redirección si la persona siguió la cuenta,
  dio "Me gusta", comentó o compartió contenido.
- Los destinos se configuran por etiqueta y se pueden modificar sin regrabarla.

## Métricas propias de TOCA

- Toques totales.
- Toques únicos estimados.
- Redirecciones completadas.
- Fecha y hora.
- Negocio, sucursal y punto físico.
- Destino y campaña configurados.
- Dispositivo y navegador aproximados, con criterios de privacidad.

## Decisiones de MVP

- Aplicación web para el administrador; el cliente final no instala nada.
- Redirección automática y rápida, sin encuesta intermedia.
- URL corta por etiqueta y QR de respaldo con la misma dirección.
- Destinos permitidos y validados para evitar el uso de TOCA como redireccionador
  malicioso.
- Panel de tráfico por etiqueta, sucursal, destino y período.
