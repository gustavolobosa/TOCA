# QA con el servidor local y Supabase actual

Fecha: 6 de octubre de 2026, hora de Chile.

## Actualización del 7 de octubre de 2026

La migración multiusuario fue aplicada con autorización al proyecto `sixsesexcfklnaiqzlqm`. La consulta REST de `profiles` pasó de HTTP 404 a HTTP 200, el perfil administrativo existe y las comprobaciones SQL confirmaron RLS, vistas y permisos restrictivos. El chequeo de seguridad de Supabase no reportó hallazgos; inmediatamente después de la migración se conservaron 1 NFC y 2 visitas.

Se levantó la aplicación con Node 22.23.3 y se recargó la sesión real del administrador en Chrome: `/panel` redirigió a `/cuenta/clave`, que respondió HTTP 200, sin errores en la consola. Se repitieron las 21 comprobaciones anónimas de Playwright con resultado correcto. La captura de este paso está en `.impeccable/review/live/migracion-aplicada.jpg` y no se publica en Git.

Después de recibir el QA por roles, el usuario informó que todo parecía funcionar. Es evidencia de QA manual informado por el usuario, no una certificación automatizada de los flujos de escritura ni del despliegue de producción. No se cambiaron credenciales del administrador mediante herramientas del agente.

Antes del commit solicitado por el usuario se repitieron lint, tipos, build de producción con Turbopack y las 17 pruebas nativas, incluida la comprobación HTTP contra un servidor de producción local: todas correctas, sin pruebas omitidas. También pasaron las 27 comprobaciones E2E con Supabase simulado. El build y estos E2E se ejecutaron en una copia temporal ignorada, sin detener el servidor del usuario ni escribir en Supabase real. La auditoría de dependencias de producción reportó cero vulnerabilidades conocidas; esto no certifica toda la seguridad de la aplicación.

La consulta de las variables de Vercel detectó que falta `ADMIN_USER_ID` en Production y Preview. La publicación requiere resolver este pendiente con autorización específica; no basta con el `ADMIN_EMAIL` antiguo. El push y el despliegue no se consideran verificados por el build local.

## Registro histórico del 6 de octubre: bloqueo anterior

Se reutilizó el servidor Next.js real que el usuario tenía en `http://localhost:3000`, con `.env.local`. No se inició el servidor de fixtures ni se sustituyó Supabase.

### Falla reproducida en la sesión existente

Se recargó el panel del navegador del usuario y se revisaron el DOM, la consola y una captura. El panel volvió a mostrar el error de `getAccount`, en `lib/auth.ts:20`.

Una consulta REST de solo lectura al proyecto `sixsesexcfklnaiqzlqm` devolvió HTTP 404, código `PGRST205`: no existe `public.profiles` en el caché del esquema. El preflight SQL confirmó:

- Migración de acceso de administrador aplicada.
- Migración multiusuario **no aplicada**.
- Administrador existente; 1 NFC y 2 visitas existentes.

La consulta de `profiles` se ejecuta después de validar la sesión. Por eso el login anónimo puede cargar mientras una sesión autenticada falla al entrar al panel. Las pruebas anteriores con fixtures no verificaban esta compatibilidad con la base real.

### Playwright sin sesión: 21 comprobaciones aprobadas

Ejecución: `node tests/e2e/read-only-live.mjs`.

Se verificaron: inicio hacia login, formulario y validación HTML, acceso anónimo denegado en cinco rutas privadas, cabeceras/caché, enlace con slug inválido, ruta inexistente, login móvil sin desborde y ausencia de errores JavaScript en esas páginas públicas.

El script usa Chrome/Playwright instalado, bloquea peticiones de escritura del navegador y no envía credenciales. El slug público usado (`x`) es inválido y no llama la función que registra visitas. Un segundo preflight confirmó que siguen existiendo 1 NFC y 2 visitas.

También se ejecutaron 16 pruebas unitarias existentes de destinos, configuración, cabeceras y fechas: todas aprobadas. Estas pruebas no comprueban las funciones SQL ni reemplazan los flujos reales bloqueados.

Evidencias locales, generadas e ignoradas por Git:

- `.impeccable/review/live/anonymous-results.json`
- `.impeccable/review/live/login-desktop.png`
- `.impeccable/review/live/login-mobile.png`
- `.impeccable/review/live/enlace-no-disponible.png`

### No verificado contra Supabase real

- Inicio de sesión con nuevas credenciales, cambio de contraseña y MFA.
- Creación/desactivación/reactivación de usuarios.
- Alta y edición de los cuatro destinos de NFC.
- Transferencia de propietario e historial.
- Redirección de un NFC válido, registro de visitas y estadísticas.
- Aislamiento RLS entre propietarios y protección de operaciones de escritura.

No se aprobaron estos flujos: están bloqueados por la migración pendiente y requieren autorización específica para sus escrituras. La aprobación anterior cubría solamente la migración de acceso de administrador.

## Siguiente paso del registro histórico: completado el 7 de octubre

Obtener autorización para aplicar `20261006015536_multiuser_nfc_destinations_and_history.sql` al proyecto actual. Crea perfiles, historial y reglas multiusuario; conserva el NFC y sus visitas, y marca al administrador para cambiar su contraseña en el siguiente acceso, sin cambiarla automáticamente. Después, completar la configuración inicial con el usuario y autorizar un conjunto acotado de cuentas/NFC/visitas de prueba para comprobar los flujos reales.
