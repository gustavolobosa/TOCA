# TOCA: MVP multiusuario

Decisiones confirmadas el 5 de octubre de 2026. Este documento actualiza el alcance del POC original de MVP_PLAN.md; no implica que lo pendiente ya esté implementado.

## Alcance confirmado

- Un solo administrador, identificado por UUID, con segundo factor obligatorio antes de habilitar clientes.
- Solo el administrador crea usuarios y NFC y reasigna etiquetas.
- Usuarios con contraseña temporal fuerte e individual. La primera entrada debe solicitar su reemplazo; no hay registro público ni envío de invitaciones en este MVP.
- El propietario puede editar nombre, destino y estado de sus NFC. No puede cambiar propietario, URL fija, identificadores ni fechas.
- Un solo destino activo por NFC: Instagram, WhatsApp, reseña de Google o HTTPS genérico.
- Instagram se configura por usuario, WhatsApp por número internacional sin mensaje predefinido y Google mediante su enlace oficial de reseñas.
- Reasignar transfiere todo el historial y los destinos anteriores al nuevo propietario. La interfaz administrativa debe advertirlo antes de confirmar. El dueño anterior pierde acceso. La etiqueta conserva su URL fija y queda pausada hasta configurar su nuevo destino.
- Desactivar un usuario bloquea el panel y pausa todos sus NFC. Reactivar la cuenta no reactiva automáticamente sus etiquetas.
- Métricas: total de visitas registradas, visitas por día, última visita y tipo de destino al momento del evento; no personas únicas, reseñas publicadas ni mensajes enviados.
- No eliminar detalle histórico hasta que se acuerde una política de retención: el propietario debe poder consultar los destinos anteriores.
- Rediseño simple y elegante, responsivo y accesible.
- Verificación en el proyecto Supabase actual, previa presentación y aprobación explícita de las migraciones y datos de prueba concretos. No crear proyectos nuevos.

## Estado actualizado al 7 de octubre de 2026

La migración `20261006015536_multiuser_nfc_destinations_and_history.sql` fue aplicada con autorización explícita en `sixsesexcfklnaiqzlqm`. Se verificaron el perfil administrativo, RLS en las cinco tablas, permisos de funciones y vistas con `security_invoker`; el chequeo de seguridad de Supabase no reportó hallazgos. Inmediatamente después se conservaron el NFC existente y sus dos visitas.

En la sesión real del administrador se comprobó `/panel` → `/cuenta/clave` con HTTP 200, sin el error previo de tabla faltante. Se repitieron 21 comprobaciones anónimas con Playwright contra el servidor real. El usuario indicó posteriormente que el QA manual parecía funcionar; esto no equivale a una ejecución automatizada certificada de todos los flujos contra Supabase real. El rediseño visual queda para una etapa posterior y el resultado del despliegue en Vercel se verifica por separado.

Las secciones siguientes conservan el registro histórico del 6 de octubre, cuando la migración todavía estaba pendiente. El estado actual de la migración es el descrito arriba.

## Estado por épica: registro histórico del 6 de octubre

| Épica | Estado |
| --- | --- |
| 0. Base de seguridad | Código local verificado con Node 22.23.3: 10 pruebas, lint, tipos y build correctos; sin alertas en dependencias de producción, 5 alertas de desarrollo pendientes; migración aplicada con autorización al proyecto sixsesexcfklnaiqzlqm y verificada mediante consultas de lectura; un NFC y dos visitas conservados; contraseña actual sin modificar; despliegue del código pendiente |
| 1. Usuarios y acceso | Implementado localmente: creación administrativa, contraseña temporal aleatoria e individual, cambio obligatorio, reautenticación y MFA para el administrador. Auth y perfiles reales pendientes de validación con aprobación |
| 2. Propiedad y permisos | Guardas por sesión y perfil implementadas. RLS, revocación de escrituras directas y RPC de servidor preparadas en la migración pendiente; no afirmar aislamiento real sin ejecutarla y comprobarlo |
| 3. Cuatro destinos | Implementado y probado: Instagram por usuario, WhatsApp por número, enlace oficial de reseñas y HTTPS genérico; destinos circulares, credenciales, IP y puertos personalizados rechazados |
| 4. Reasignación e historial completo | Interfaz y funciones preparadas: URL NFC estable, transferencia de todo el historial, pausa y configuración obligatoria. Flujo probado en simulación; transacciones reales pendientes |
| 5. Redirección y medición | Redirección directa preparada con registro de tipo al visitar, sin registrar HEAD ni precargas. Totales, última visita, detalle paginado y estadísticas de 30 días. Sin nuevas IP ni user-agent; eventos heredados conservados |
| 6. Verificación integral y producción | 17 pruebas nativas y 27 comprobaciones Playwright correctas; lint, tipos y build de producción correctos. Playwright usa Supabase simulado; RLS y SQL reales, rediseño y publicación siguen pendientes |

## Evidencia y límites de la verificación

Comprobado el 6 de octubre de 2026 con Node 22.23.3. Las comprobaciones Playwright ejecutan la aplicación Next.js y sus Server Actions en Chrome, conectados a un servidor Supabase simulado en memoria. No usan cuentas reales ni escriben en PostgreSQL. Prueban recorridos y controles de la aplicación, **no la implementación real de Auth, RLS ni las transacciones SQL**.

Las 17 pruebas nativas incluyen el límite de 30 días de calendario de Chile a través de cambios de hora y las respuestas HTTP de un build de producción servido localmente: login disponible, rutas privadas redirigidas y cabeceras contra caché compartida, iframes y filtración del referente. Se revisaron 25 archivos públicos del build sin encontrar las claves secretas del servidor ni la contraseña de la base. Las consultas de lectura al proyecto actual conservan un NFC y dos visitas; la migración multiusuario no está aplicada.

Dependencias: `sharp` se actualizó a 0.35.5, dentro del rango compatible de Next.js, para corregir GHSA-wq5f-xc86-pv6w (librsvg 2.63.2). La auditoría de producción vuelve a indicar cero vulnerabilidades conocidas. Persisten cinco alertas altas de desarrollo en la cadena de lint (`braces`/`micromatch`); `npm audit fix --force` propone degradar eslint-config-next a Next 14, por lo que no se aplicó esa solución incompatible. Fuente de la corrección: [aviso oficial del mantenedor](https://github.com/advisories/GHSA-wq5f-xc86-pv6w).

Revisión visual independiente: `disposition: ship`, limitada a tres correcciones puntuadas (contraste al pausar, tracking de marca/título y eliminación de la franja lateral gruesa). No certifica el rediseño ni todas las pantallas. El harness no ofrece los roles específicos de Impeccable; se usaron agentes frescos con sus contratos de revisión/documentación. La comprobación de documentación conservó el sistema incumbente y no creó DESIGN.md ni una identidad no aprobada.

El rediseño simple y elegante sigue pendiente de decidir el flujo de revisión con el usuario. Las pantallas nuevas heredan la interfaz existente; las correcciones de contraste, etiquetas accesibles y reflujo móvil no equivalen a un rediseño aprobado.

## Procedimiento de migración: registro histórico, ya aplicada el 7 de octubre

`20261006015536_multiuser_nfc_destinations_and_history.sql` agrega perfiles, tipos de destino, historial y auditoría, revoca las escrituras directas de los clientes y expone operaciones transaccionales únicamente a la clave de servidor. No elimina cuentas, etiquetas ni eventos; no cambia contraseñas de Auth. La cuenta administradora deberá cambiar su clave al entrar con el código nuevo y configurar MFA.

La aplicación publicada anterior podría perder acceso al panel si se aplica la migración antes de publicar el código nuevo. Coordinar ambos cambios mediante aprobaciones explícitas y verificaciones; no ejecutar `db push` por inercia.

1. Consultar `scripts/preflight-multiuser.sql` (solo lectura): admin existente, migración base aplicada, propietarios heredados y URLs que necesiten revisión.
2. Obtener aprobación específica para esa migración en `sixsesexcfklnaiqzlqm`.
3. Aplicarla y comprobar permisos, vistas y funciones; no alterar la contraseña ni el MFA del administrador mediante scripts.
4. Con aprobación independiente, crear dos cuentas/etiquetas E2E y comprobar acceso cruzado, escrituras rechazadas, historial, pausas y redirecciones contra Supabase real. Registrar el alcance y dejar los datos de prueba desactivados.
5. Obtener aprobación para publicar los cambios concretos en Git/Vercel; configurar el dominio HTTPS y el UUID administrativo antes del despliegue.
6. Verificar el despliegue y realizar la configuración inicial de contraseña/MFA personalmente. Grabar únicamente la URL fija de TOCA en NFC Tools.

Antes de habilitar clientes, revisar también la configuración de Auth: mínimo de contraseña de 12 caracteres, exigir contraseña actual al cambiarla, TOTP habilitado, registro público y usuarios anónimos deshabilitados. Estos ajustes no fueron modificados ni verificados en este turno y requieren autorización específica. El mínimo debe exigirse en Supabase, no solo en el formulario, porque la API Auth puede invocarse directamente. La aplicación reautentica y además envía `current_password` para ser compatible con la validación nativa. Fuente: [seguridad de contraseñas de Supabase](https://supabase.com/docs/guides/auth/password-security).

## Reglas de ejecución

1. Implementar y verificar cada épica antes de avanzar.
2. Aprovechar Supabase Auth, RLS, las funciones nativas de Next.js y el runner de pruebas de Node.js; no incorporar dependencias sin necesidad.
3. No modificar la base, ni siquiera durante comprobaciones con rollback, sin aprobación del cambio y destino concretos.
4. No realizar escrituras de Git, instalar hooks de Git ni desplegar sin autorización expresa.
5. No afirmar que la seguridad de producción está verificada cuando solo se ha revisado el repositorio o las pruebas aisladas.

## Fuera del alcance

Pagos, equipos, varios administradores, registro público, aplicación móvil, escritura NFC desde el navegador, hardware propio, búsqueda automática de negocios y publicación o selección automática de estrellas en Google.
