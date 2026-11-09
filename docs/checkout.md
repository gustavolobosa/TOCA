# Mercado Pago de prueba en el sitio de producción

El modo de Mercado Pago se controla con `TOCA_CHECKOUT_MODE`, independientemente de si TOCA corre en Production, Preview o desarrollo local. Usa el proyecto Supabase actual de TOCA; no necesitas un segundo proyecto.

- `test`: habilita el checkout con el vendedor y comprador ficticios de Mercado Pago, también en Production.
- `off` o variable ausente: deshabilita el checkout y conserva la consulta por WhatsApp.
- Los cobros reales todavía no están implementados. Cambiar el flag a `live` no los habilita.

Con `test` en Production, los visitantes del sitio también verán el checkout y su aviso de prueba. Los registros se guardan en la base real, dentro de una tabla exclusiva para intentos ficticios.

Flujo: Inicio → Precios → confirmar plan → checkout de Suscripciones de Mercado Pago → resultado automático en TOCA. Se compra un NFC por intento. En esta etapa no se crean cuentas, no se activan NFC y no se generan envíos ni documentos tributarios.

| Plan | Neto | IVA | Total cobrado | Renovación |
| --- | ---: | ---: | ---: | --- |
| Mensual | $2.200 | $418 | $2.618 | Cada mes |
| Anual | $22.000 | $4.180 | $26.180 | Cada 12 meses |

El año se paga por adelantado: 12 meses por el precio de 10. Los importes se definen una sola vez en `lib/pricing.ts`; el servidor nunca acepta un precio enviado por el navegador.

## 1. Preparar la tabla en el Supabase actual

El registro reserva cada intento y recupera la misma suscripción aunque Vercel cambie de instancia o haya un corte de conexión. Reutiliza `SUPABASE_URL`, `SUPABASE_SECRET_KEY` y la validación del proyecto que ya usa TOCA.

En el SQL Editor del **proyecto Supabase real de TOCA**, ejecuta una sola vez el contenido de:

`supabase/migrations/20261109130000_checkout_test_attempts.sql`

Este archivo crea únicamente `public.checkout_test_attempts`, activa RLS y restringe el acceso al servidor. No cambia perfiles, usuarios ni NFC existentes. Ejecuta únicamente este archivo si las migraciones anteriores ya están aplicadas.

Conserva las variables de Supabase actuales. Ya no se utilizan las variables `CHECKOUT_SUPABASE_URL` ni `CHECKOUT_SUPABASE_SECRET_KEY` de la propuesta anterior.

La migración está preparada en el repositorio; **no se ha aplicado automáticamente**.

## 2. Configurar Vercel

En el proyecto TOCA, abre **Settings → Environment Variables**. Agrega las siguientes variables con alcance **Production**; puedes aplicarlas también a Preview si lo necesitas:

| Variable | Valor |
| --- | --- |
| `TOCA_CHECKOUT_MODE` | `test` |
| `MERCADOPAGO_TEST_ACCESS_TOKEN` | El token del vendedor ficticio que ya usamos localmente; está en `.env.local`. |
| `CHECKOUT_SESSION_SECRET` | Un secreto aleatorio nuevo de al menos 32 caracteres. |

Puedes generar el secreto de sesión en tu terminal con `openssl rand -hex 32`. Pégalo en Vercel y consérvalo entre despliegues de la misma prueba. Marca las claves y tokens como sensibles. Ninguna de estas variables lleva el prefijo `NEXT_PUBLIC_`.

Para este checkout alojado en Mercado Pago **no se necesita Public Key**, Client Secret ni contraseña del comprador en Vercel. Usa el token del vendedor ficticio, no el de la empresa real: el código comprueba el usuario vendedor `3828192200`, su país y su condición de cuenta de prueba antes de crear o cancelar suscripciones. El prefijo `APP_USR` por sí solo no indica si la cuenta es real o ficticia.

Mantén las variables normales de TOCA. Verifica que `NEXT_PUBLIC_SITE_URL` sea el origen HTTPS de tu sitio real, sin rutas: este dominio se admite para iniciar la compra y recibir el retorno. `SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_URL` deben seguir apuntando al mismo proyecto real.

Las URLs automáticas de Vercel (`VERCEL_URL` y `VERCEL_BRANCH_URL`) también se admiten. No necesitas falsificar `VERCEL_ENV` ni cambiar `NODE_ENV`: el modo de Mercado Pago depende exclusivamente del flag.

Opcional: para otro alias agrega `CHECKOUT_BASE_URL=https://tu-alias` (sin rutas, parámetros ni fragmentos). No hace falta si usas el dominio de `NEXT_PUBLIC_SITE_URL`. La URL de retorno conserva el mismo dominio desde el que empezaste la compra.

## 3. Desplegar y activar el flag

Incorpora estos cambios a la rama que Vercel usa para Production y despliega después de guardar las variables. Tú ejecutas los comandos de Git; este cambio no se publicó automáticamente.

Si el código ya estaba desplegado, haz **Redeploy** después de cambiar las variables. Para deshabilitar la compra ficticia, cambia `TOCA_CHECKOUT_MODE=off` y vuelve a desplegar. Los precios nuevos permanecen en la página.

Usa siempre el mismo dominio y navegador durante la compra; volver a otro hostname o borrar las cookies impide recuperar la sesión. Si tu despliegue tiene protección de Vercel, autoriza primero el acceso desde ese navegador.

Documentación oficial: [variables por entorno](https://vercel.com/docs/environment-variables), [entornos de despliegue](https://vercel.com/docs/deployments/environments) y [variables automáticas del sistema](https://vercel.com/docs/environment-variables/system-environment-variables).

## 4. Configuración en Mercado Pago

Usa la aplicación de Suscripciones y las cuentas ficticias ya creadas. No necesitas crear un plan manual en el panel: TOCA crea la suscripción mensual o anual por API con el importe del servidor y la URL de retorno del sitio.

No hay que registrar un webhook para esta fase. La página consulta automáticamente a TOCA y el servidor verifica la suscripción y el pago directamente en Mercado Pago. La autorización de la suscripción por sí sola nunca muestra “pago confirmado”. El navegador tampoco puede confirmar el pago mediante parámetros de retorno.

Este mecanismo actualiza el resultado mientras la página está abierta; al volver a abrirla consulta otra vez. **No procesa renovaciones ni activa servicios en segundo plano**. Esa parte requerirá notificaciones verificadas y persistencia de pagos en la etapa de activación.

Referencia oficial: [pruebas de integración, incluida Suscripciones](https://www.mercadopago.cl/developers/es/news/2023/11/16/Questions-on-how-to-test-your-integration--).

## 5. Hacer la prueba completa

1. Abre el sitio de TOCA → **Ver planes y contratar** → elige mensual o anual.
2. Verifica el total con IVA y presiona **Suscribirme con Mercado Pago**.
3. En Mercado Pago usa la sesión del **comprador ficticio** o el flujo de invitado con su correo. Si tienes iniciada la sesión de tu cuenta real o del vendedor, cambia a la del comprador de prueba. Esto separa las cuentas de prueba; no obliga a un futuro cliente real a cerrar su sesión.
4. Introduce la tarjeta ficticia. No uses saldo ni tarjetas reales.
5. Confirma y vuelve a TOCA desde Mercado Pago. Si no vuelve automáticamente, abre `/comprar/resultado` en el mismo dominio y navegador.
6. Espera **Pago de prueba confirmado**. La consulta se repite automáticamente, con intervalos de 5 a 30 segundos; se pausa si ocultas la pestaña o pierdes conexión. Puede tardar mientras Mercado Pago procesa el primer cobro.
7. Guarda la referencia y el ID del pago. Cancela la suscripción con el botón de TOCA para detener futuras renovaciones de prueba. La cancelación no representa una devolución del primer pago.
8. Repite con el otro plan. Verifica $2.618 mensual y $26.180 anual. Prueba también con la sesión del comprador ficticio ya iniciada.

| Dato | Valor de prueba |
| --- | --- |
| Correo comprador | `test_user_8501473770136902242@testuser.com` |
| Usuario comprador | `TESTUSER8501473770136902242` |
| Código de verificación de la cuenta ficticia | `192198` |
| Mastercard | `5416 7526 0258 2580` |
| Vencimiento | `11/30` |
| CVV | `123` |
| Titular | `APRO` |
| Documento, si se solicita | Tipo `Otro`, número `123456789` |

Estos datos también aparecen en “Datos para probar el pago” dentro de TOCA. [Tarjetas de prueba oficiales](https://www.mercadopago.cl/developers/es/docs/your-integrations/test/cards).

## Si algo falla

- **Solo aparece WhatsApp:** verifica `TOCA_CHECKOUT_MODE=test`, alcance Production y que hiciste un despliegue después de guardar las variables.
- **No se pudo acceder al registro:** revisa las variables habituales de Supabase y que `checkout_test_attempts` exista en ese proyecto.
- **Dominio no permitido:** revisa `NEXT_PUBLIC_SITE_URL`. Para un alias adicional configura `CHECKOUT_BASE_URL` y vuelve a desplegar.
- **Sesión no encontrada o vencida:** usa el mismo navegador y dominio. La sesión dura 24 horas. Antes de repetir una compra, revisa y cancela la anterior en la cuenta ficticia de Mercado Pago.
- **Creación en verificación:** hubo una respuesta incierta. TOCA busca la suscripción por su referencia y evita repetir el POST de creación. Si queda en ese estado, conserva la referencia y revisa el registro y Mercado Pago antes de empezar otra compra. No borres el registro para forzar un reintento: podría existir una suscripción creada.
- **Autorizada pero sin pago aprobado:** sigue esperando el resultado automático; aún no hay confirmación de cobro.

La protección contra duplicados cubre el mismo intento y su cookie, incluso entre instancias de Vercel. No identifica a una misma persona entre navegadores ni después de borrar cookies; ese control corresponde a la futura compra asociada a una cuenta.

La comprobación definitiva pendiente es completar ambos pagos ficticios en el sitio configurado. Compilar y revisar la interfaz local no sustituye esa prueba con Vercel, Supabase y Mercado Pago conectados.
