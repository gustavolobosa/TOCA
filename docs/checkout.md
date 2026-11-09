# Registro, compras y suscripciones de TOCA

Flujo: plan y cantidad → registro con correo y contraseña → confirmar correo → checkout alojado de Mercado Pago → confirmación automática → NFC propios con destino inicial `https://example.com`.

El propietario se obtiene de la sesión verificada de TOCA. En producción, el cliente puede usar su sesión de Mercado Pago aunque tenga otro correo: la propiedad no depende del correo de la billetera. Mercado Pago puede solicitar sus propias validaciones de identidad o del medio de pago; TOCA no puede omitirlas.

## 1. Migración pendiente: ejecutar antes de publicar el código

En el SQL Editor del **Supabase actual de TOCA**, ejecuta completo:

`supabase/migrations/20261109152816_checkout_production_billing.sql`

Codex dejó el archivo preparado; **no lo ejecutó**. Requiere las migraciones anteriores, incluida `20261109132803_checkout_accounts_and_nfc_fulfillment.sql`, que ya aplicaste. En una instalación nueva, aplica todas las migraciones en orden.

La migración conserva la tabla histórica `checkout_test_attempts`, agrega `mode`, correo verificado de compra, vigencia y estado de facturación. Las compras anteriores quedan como `test`; no se convierten en compras reales. Agrega `checkout_payments` para los cobros reales, una RPC transaccional de conciliación y la comprobación de vigencia en `resolve_nfc`. Las tablas de cobro y sus RPC son exclusivas del servidor (`service_role`).

Los NFC manuales y los de prueba mantienen su comportamiento anterior. La migración no cobra, cancela suscripciones ni genera NFC por sí sola. El código anterior puede seguir funcionando en modo de prueba mientras publicas la versión nueva.

## 2. Variables de Vercel

En **Project → Settings → Environment Variables**, configura **Production**. No copies credenciales reales a Preview. Para Preview utiliza `TOCA_CHECKOUT_MODE=test` y las credenciales de prueba.

| Variable | Valor para cobrar realmente |
| --- | --- |
| `TOCA_CHECKOUT_MODE` | `production` |
| `MERCADOPAGO_ACCESS_TOKEN` | Access Token de **producción de la empresa real** |
| `MERCADOPAGO_SELLER_ID` | **User ID numérico** de esa cuenta real de Mercado Pago; no es el RUT ni el número de aplicación |
| `MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET` | Clave secreta de Webhooks de esa misma aplicación real |
| `CRON_SECRET` | Secreto aleatorio nuevo de al menos 32 caracteres |
| `NEXT_PUBLIC_SITE_URL` | `https://toca-one.vercel.app` |
| `CHECKOUT_BASE_URL` | `https://toca-one.vercel.app` (opcional si ya coincide con Site URL) |
| `CHECKOUT_SESSION_SECRET` | Conserva el secreto estable que ya tienes; mínimo 32 caracteres |

Para generar **CRON_SECRET**, ejecuta localmente `openssl rand -hex 32` y pega el resultado únicamente en el gestor de secretos de Vercel. No lo incluyas en Git.

Conserva las variables de Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`) y `ADMIN_USER_ID`, sin cambiar de base de datos.

Conserva también `MERCADOPAGO_TEST_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET`: esta última sigue siendo la firma **del vendedor ficticio**, para recibir eventos y gestionar las compras de prueba existentes. No la reemplaces por la firma real. `MERCADOPAGO_TEST_PUBLIC_KEY` solo corresponde al formulario local de pruebas; el checkout alojado no requiere Public Key ni SDK de tarjeta.

Los secretos nunca llevan `NEXT_PUBLIC_`. No necesitas una API key de Resend en la aplicación para el registro: el envío lo realiza Supabase mediante el SMTP que ya configuraste.

El servidor comprueba `/users/me` antes de crear o conciliar una suscripción: país Chile, ID esperado y condición real/ficticia. El prefijo `APP_USR` del token no basta para distinguir los modos.

Las variables de `.env.local` no configuran Vercel. Cambiar las variables requiere **un nuevo deployment**. Mantén `test` hasta estar listo para el primer cobro real. [Variables de Vercel](https://vercel.com/docs/environment-variables).

## 3. Webhook real de Mercado Pago

En Mercado Pago Developers, entra en la **aplicación de la empresa real** que emitió `MERCADOPAGO_ACCESS_TOKEN`. En Webhooks → **Modo productivo**, guarda:

```text
https://toca-one.vercel.app/api/mercadopago/webhook?mode=production
```

Selecciona **Planes y suscripciones** y **Pagos** (puede aparecer como **Pagos legacy**). Se procesan:

- `subscription_preapproval`: cambios de suscripción.
- `subscription_authorized_payment`: factura/cobro periódico.
- `payment`: aprobación, rechazo, devolución o contracargo del pago.

Copia la clave secreta de esta configuración a `MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET`. No es el Access Token ni un secreto que debas inventar.

Conserva en la aplicación ficticia su URL anterior:

```text
https://toca-one.vercel.app/api/mercadopago/webhook
```

La URL sin `mode` sigue significando **test**, aunque TOCA esté cobrando en producción. También admite `?mode=test`. No mezcles una aplicación, token o firma real con la URL de pruebas.

El endpoint debe ser accesible para Mercado Pago sin sesión de Vercel. Si hay protección del deployment o reglas de firewall, permite específicamente esta ruta. Un GET manual no comprueba el webhook: recibe POST firmado. Una notificación sin firma válida devuelve 401; un simulador sin recurso real asociado no acredita compras.

La firma se valida antes de consultar la API. Luego se verifica vendedor, modo, referencia, moneda, importe y pertenencia del pago a la factura de la suscripción. Una redirección del navegador no acredita pagos. [Documentación de Webhooks](https://www.mercadopago.cl/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/webhooks), [consulta de facturas](https://www.mercadopago.cl/developers/es/reference/online-payments/subscriptions/authorized-payment-search/get).

## 4. Publicación y revisión programada

Orden recomendado:

1. Ejecuta la migración.
2. Configura credenciales y Webhooks; conserva el modo `test` hasta terminar la preparación.
3. Publica estos cambios con tu commit/push. Codex no realiza operaciones de escritura de Git.
4. Guarda `TOCA_CHECKOUT_MODE=production` en Vercel Production y genera un nuevo deployment (o inclúyelo en el despliegue anterior si todo está listo).
5. Abre la URL pública: la compra real ya no debe mostrar el aviso ni la tarjeta de prueba.
6. Comprueba en Vercel → Schedules / Cron Jobs que aparezca `/api/cron/checkout` y que `CRON_SECRET` esté configurado.

`vercel.json` programa una revisión diaria a las **06:00 UTC**, como respaldo al webhook y a las consultas automáticas de la pantalla. Revisa hasta **20 compras reales por ejecución**, empezando por las menos revisadas, incluidas canceladas para detectar pagos tardíos. También funciona con el checkout en `off`. No crea suscripciones, no solicita cobros y no emite devoluciones: consulta pagos existentes y actualiza NFC.

Esta revisión es un respaldo para bajo volumen, no una garantía de revisar todas las compras cada día. Con más de 20 compras históricas, aumenta la frecuencia del cron (por ejemplo `*/15 * * * *` en un plan que lo permita) y revisa la capacidad del lote. El endpoint devuelve `checked` y `failed`; revisa los fallos 503 en los logs y no des por recuperado un pago solo porque se ejecutó el cron. Las notificaciones y el resultado de compra no esperan al cron.

Para un sitio comercial, Vercel indica que Hobby es de uso personal/no comercial: utiliza un plan habilitado para uso comercial, como Pro. [Condiciones del plan Hobby](https://vercel.com/docs/plans/hobby). Los cron usan `Authorization: Bearer CRON_SECRET`; Vercel agrega ese encabezado automáticamente. [Administración de Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## 5. Qué pasa con los pagos y los NFC

- **Primer cobro aprobado:** se crean exactamente las unidades compradas, con propietario autenticado de TOCA, destino `https://example.com`, nombre inicial `NFC 1`, etc. y `is_test=false` en producción.
- **Notificaciones duplicadas o simultáneas:** la compra se bloquea en una transacción; no se generan unidades extra. Un pago no puede acreditarse a dos compras.
- **Renovación aprobada:** extiende la vigencia de los mismos NFC según el período de la factura. No crea NFC adicionales ni cambia los destinos o pausas del cliente.
- **Período:** comienza en `debit_date` de la factura de Mercado Pago y termina un mes o doce meses después, calculado en UTC. Los reintentos no suman meses desde el momento en que llega un webhook.
- **Pago rechazado o pendiente:** no otorga ni extiende vigencia. Si ya había un período pagado, se conserva hasta su vencimiento.
- **Cancelar renovación desde Mis compras:** detiene futuras renovaciones; conserva el período pagado. No devuelve dinero ni borra NFC. Los cobros ya en procesamiento pueden requerir revisar su resultado en Mercado Pago.
- **Devolución total o parcial:** ese cobro deja de aportar vigencia; no hay prorrateo automático. Puede quedar vigente otro período pagado. El reembolso se realiza desde Mercado Pago, no desde TOCA.
- **Contracargo:** suspende los NFC de esa compra mientras exista un pago con ese estado. El cambio se aplica cuando la API y su conciliación lo confirman.
- **Vencimiento:** cada escaneo comprueba la vigencia en la base de datos. Un servicio vencido deja de redirigir, aunque no haya llegado otro webhook. La etiqueta conserva su propietario, destino e historial.

`authorized` en la suscripción no equivale a un pago aprobado. La activación requiere consultar el pago real y una factura vinculada; `live_mode=true` también es obligatorio en producción. Actualizaciones antiguas del mismo pago no sobreescriben estados más recientes.

El importe se calcula en el servidor y queda guardado en la compra. Por ahora no hay descuentos/cupones propios ni cambios de cantidad sobre una suscripción existente; no edites importe o frecuencia directamente en Mercado Pago, porque dejarían de coincidir con lo contratado en TOCA.

Esto administra el servicio digital. No programa ni despacha las etiquetas físicas, ni genera documentos tributarios.

## 6. Comprobar el primer cobro real

1. Entra a TOCA con tu cuenta verificada. El cambio a producción no requiere registrarte otra vez.
2. Inicia una **compra nueva** desde Precios: los enlaces de compras de prueba siguen siendo de prueba.
3. Elige **mensual, 1 NFC**: total **$2.618 CLP con IVA**, con renovación mensual.
4. Abre Mercado Pago y utiliza una tarjeta real y una cuenta compradora real distinta de la cuenta vendedora. No uses el comprador ficticio ni la tarjeta `5416…2580`.
5. Confirma el cobro. Es una compra real: se descontará dinero y se autoriza la renovación.
6. Al volver, espera la confirmación automática. Comprueba **Mis compras**, el monto, la vigencia y que aparezca un solo NFC nuevo sin marca de prueba, propio y con destino `https://example.com`.
7. Recarga y vuelve a entrar: debe seguir existiendo una sola unidad. Comprueba también el pago en Mercado Pago y que la notificación correspondiente termine con HTTP 200.
8. Para comprobar independencia de la pestaña, en otra compra cierra la pestaña después de confirmar en Mercado Pago y vuelve al panel más tarde: el webhook debe haber asignado los NFC. Esta comprobación implica otro cobro real.
9. Si solo querías validar el circuito, cancela la renovación en **Mis compras → Ver compra → Cancelar renovación**. Si deseas una devolución, hazla en Mercado Pago y verifica después su reflejo en TOCA.

No uses un enlace antiguo ni repitas una compra si el resultado es incierto: abre Mis compras y deja que consulte el mismo intento. Una creación con timeout no se vuelve a enviar automáticamente.

| Por NFC | Neto | IVA | Total |
| --- | ---: | ---: | ---: |
| Mensual | $2.200 | $418 | $2.618 |
| Anual: 12 meses, pagas 10 | $22.000 | $4.180 | $26.180 |

Cantidad entre 1 y 100; aumento lineal. Tres NFC: $7.854 mensuales o $78.540 anuales, IVA incluido. Los precios no cambiaron en esta implementación.

## 7. Mantener las pruebas y volver atrás

- `test`: acepta compras nuevas ficticias, usando el Supabase habitual. Comprador `test_user_8501473770136902242@testuser.com`; Mastercard `5416 7526 0258 2580`, `11/30`, CVV `123`, titular `APRO`.
- `production`: acepta compras nuevas reales con las credenciales de la empresa.
- `off`: deshabilita compras nuevas y registro; las compras existentes siguen disponibles desde Mis compras y conservan webhooks, cancelación y conciliación. No cancela las suscripciones de Mercado Pago.

Cambiar a `test` u `off` no convierte, borra ni cancela las suscripciones reales ya creadas. Mantén sus credenciales y firma real para que sigan conciliándose y puedan cancelarse.

La configuración existente de Supabase Auth/SMTP y la plantilla `{{ .Token }}` se conserva. El código de seis dígitos se configura en Supabase; la app ya acepta ese tamaño. Para nuevos proyectos, activa Email/Password, Confirm email, registros y SMTP propio. Usa Site URL `https://toca-one.vercel.app`.

## Si algo falla

- **Credenciales incompatibles:** verifica User ID real, token de la misma cuenta chilena y que no sean del vendedor ficticio.
- **Webhook 401:** revisa modo de la URL y firma de esa misma aplicación. No uses el Access Token como firma.
- **Webhook 503 o pago aprobado sin NFC:** revisa migración, disponibilidad de Supabase/MP y cuenta activa. Abre el resultado de esa compra; no generes otra para reparar la primera.
- **NFC sin vigencia:** consulta el pago y la fecha en Mis compras. Activar manualmente el interruptor del NFC no evita el control de facturación.
- **Más de 1000 facturas en una suscripción:** el servidor detiene la conciliación con un error explícito; hay que ampliar la estrategia de paginación antes de alcanzar ese límite.
- **Correo no recibido:** revisa SMTP, plantilla, remitente, límites y spam en Supabase/Resend. Es independiente del modo de Mercado Pago.

Validar compilación y tipos no demuestra una transacción real ni la ejecución correcta de SQL en tu proyecto. La prueba integral requiere que ejecutes la migración, publiques las variables y completes el primer pago.
