# TOCA - Plan del MVP

## Objetivo

Validar que una persona pueda crear un enlace NFC desde un panel, grabar esa URL
manualmente con NFC Tools, tocar la etiqueta desde un teléfono, llegar al destino
configurado y ver el toque registrado en TOCA.

## Posicionamiento acordado

**TOCA es un enlace NFC dinámico y medible; comercialmente se presenta mediante
casos concretos.**

El POC construirá un motor de redirecciones genérico. Los casos comerciales como
reseñas, redes sociales, menús y promociones no tendrán módulos separados en
esta primera versión.

## Criterio de éxito

1. El administrador crea una etiqueta llamada, por ejemplo, `Mesa 1`.
2. TOCA genera una URL pública corta y copiable.
3. La URL se graba manualmente en una etiqueta con NFC Tools.
4. Un teléfono toca la etiqueta y es redirigido al destino configurado.
5. El panel incrementa el contador y muestra la hora del último toque.
6. El administrador cambia el destino sin volver a grabar la etiqueta.

## Decisiones confirmadas

- Un único administrador, `gustaolobosas@gmail.com`, creado manualmente y sin
  registro público de usuarios.
- Interfaz en español.
- Aplicación web responsiva, sin aplicación móvil nativa.
- Next.js con App Router y runtime Node.js.
- Supabase para autenticación y Postgres; el proyecto todavía debe crearse.
- Despliegue en Vercel con HTTPS y uso inicial del dominio `vercel.app`.
- Cualquier destino `https://` válido, configurado solo por un administrador.
- Sin QR, sucursales, equipos, roles, facturación ni integraciones externas.
- Sin visitantes únicos, cookies de seguimiento ni almacenamiento de direcciones IP.
- La primera medición mostrará el total de toques y la fecha del último toque.
- La experiencia pública usará redirección directa, sin página intermedia.
- Negocio, sucursal y punto físico se representarán temporalmente en el nombre
  descriptivo del NFC, sin tablas separadas.

Las variables requeridas están documentadas en `.env.example`. Los valores reales
se guardarán en `.env.local` y en las variables de entorno de Vercel, nunca en Git.

## Épica 1 - Base técnica y acceso

**Resultado:** aplicación desplegable y panel privado.

- Crear el proyecto Next.js con TypeScript y App Router.
- Usar una versión estable y corregida de Next.js y Node.js 22 o superior.
- Configurar variables de entorno de Supabase.
- Implementar inicio y cierre de sesión con Supabase Auth.
- Crear manualmente el único usuario administrador.
- Proteger las rutas del panel.

## Épica 2 - Modelo mínimo de datos

**Resultado:** persistencia segura de etiquetas y toques.

Tabla `nfc_links`:

- Identificador interno.
- Propietario.
- Nombre visible, por ejemplo `Mesa 1`.
- Slug público aleatorio y único.
- URL de destino.
- Estado activo o inactivo.
- Fechas de creación y actualización.

Tabla `redirect_events`:

- Identificador interno.
- Etiqueta relacionada.
- Fecha y hora del toque.
- Copia de la URL de destino utilizada al momento del toque.
- User agent opcional para diagnóstico básico.

Seguridad:

- RLS habilitado en todas las tablas expuestas.
- El administrador solo puede ver y modificar sus propios enlaces.
- Los eventos se escriben desde el servidor y no mediante inserciones anónimas.
- Índices para slug, relación con la etiqueta y orden temporal de eventos.

## Épica 3 - Administración de etiquetas

**Resultado:** el administrador puede operar sus NFC desde una interfaz pequeña.

- Listar etiquetas.
- Crear una etiqueta con nombre y URL de destino.
- Generar automáticamente el slug y la URL de TOCA.
- Copiar la URL para grabarla con NFC Tools.
- Editar nombre y destino.
- Activar o desactivar una etiqueta.
- Mostrar el total de toques y el último toque.

## Épica 4 - Redirección y registro

**Resultado:** cada toque queda registrado antes de abrir el destino.

- Crear la ruta pública `/t/[slug]`.
- Buscar una etiqueta activa por su slug.
- Registrar el evento.
- Redirigir inmediatamente con una respuesta HTTP temporal.
- No mostrar una página intermedia cuando el enlace esté activo.
- Evitar caché para que cada toque pase por el servidor.
- Mostrar una página sencilla si el enlace no existe o está desactivado.
- Validar el destino antes de guardarlo para evitar URLs peligrosas.

## Épica 5 - Verificación de la prueba de concepto

**Resultado:** flujo real probado desde el hardware hasta el panel.

- Desplegar en Vercel y conectar Supabase.
- Crear dos enlaces con destinos distintos.
- Grabar dos etiquetas mediante NFC Tools.
- Probar toques desde un teléfono.
- Confirmar redirección, incremento del contador y último toque.
- Cambiar un destino y confirmar que la etiqueta física sigue funcionando.

## Fuera del MVP

- Escritura NFC desde el navegador.
- Encuestas y estrellas internas.
- Google Business Profile y Google Places.
- Medición de seguidores, Me gusta o reseñas publicadas.
- Organizaciones, sucursales, mesas como entidades separadas y múltiples usuarios.
- Gráficos avanzados, exportaciones y alertas.
- QR, personalización visual por negocio y dominio propio por cliente.
- Facturación, planes y límites de uso.
