# Registro, compra y asignación de NFC

Flujo: elegir plan y cantidad → crear cuenta con correo y contraseña (o ingresar) → confirmar correo → pagar en Mercado Pago → recibir los NFC en el panel.

`TOCA_CHECKOUT_MODE=test` habilita este flujo también en Production, usando el Supabase real y las credenciales del vendedor ficticio de Mercado Pago. `off` deshabilita el checkout y el registro. Los cobros reales todavía no están implementados.

La cuenta de **TOCA usa un correo al que el cliente tenga acceso** y su propia contraseña. La cuenta **compradora de Mercado Pago sigue siendo ficticia**. No se vinculan usuarios por coincidencias de correo: el propietario sale de la sesión autenticada de TOCA.

## 1. Aplicar la migración antes de desplegar

Si ya ejecutaste las migraciones de la tabla de intentos y de cantidad, aplica solamente:

`supabase/migrations/20261109132803_checkout_accounts_and_nfc_fulfillment.sql`

En una instalación nueva, primero se necesitan todas las migraciones anteriores de TOCA, incluidas `20261109130000_checkout_test_attempts.sql` y `20261109131003_checkout_nfc_quantity.sql`.

La nueva migración:

- Asocia las compras nuevas a `profiles.id` y conserva su importe y origen.
- Deja las compras anteriores sin propietario. No genera NFC retroactivamente ni intenta adivinar a quién pertenecen.
- Agrega a los NFC el identificador de compra, su número de unidad y `is_test`.
- Crea dos funciones accesibles únicamente por `service_role`: preparar el perfil de un usuario verificado y asignar todas las unidades de una compra aprobada.
- Conserva los permisos, propietarios y contraseñas existentes. Los usuarios creados por el administrador mantienen su obligación de cambiar la contraseña temporal.
- Conserva las columnas anteriores de la vista del panel y agrega la marca de prueba al final.

**Este archivo está preparado, no ejecutado por Codex.**

## 2. Configurar Supabase Auth

En el proyecto actual de TOCA:

1. Habilita el registro de nuevos usuarios y el proveedor **Email / Password**.
2. Activa **Confirm email**. El registro requiere verificar el correo antes del pago.
3. Configura **Custom SMTP** con un remitente de tu dominio para entregar correos a clientes. El servidor predeterminado de Supabase restringe la entrega a miembros del equipo; no es suficiente para clientes externos.
4. En **Email Templates → Confirm signup**, incluye el código `{{ .Token }}`. La pantalla de TOCA permite introducir ese código, sin depender de abrir enlaces de confirmación en el mismo dispositivo.

Ejemplo del contenido de la plantilla:

```html
<h2>Confirma tu cuenta de TOCA</h2>
<p>Ingresa este código en la pantalla donde te registraste:</p>
<p><strong>{{ .Token }}</strong></p>
<p>Si no solicitaste una cuenta, ignora este mensaje.</p>
```

Conserva los límites de envío e intentos de Supabase. Usa como **Site URL** el dominio HTTPS de TOCA. Los clientes con cuenta existente ingresan con correo y contraseña; no vuelven a registrarse.

Referencias: [contraseñas y confirmación](https://supabase.com/docs/guides/auth/passwords), [plantillas](https://supabase.com/docs/guides/auth/auth-email-templates), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## 3. Variables en Vercel

En **Settings → Environment Variables → Production** (y Preview si corresponde), conserva:

| Variable | Valor |
| --- | --- |
| `TOCA_CHECKOUT_MODE` | `test` |
| `MERCADOPAGO_TEST_ACCESS_TOKEN` | Token del vendedor ficticio de TOCA, ID `3828192200` |
| `CHECKOUT_SESSION_SECRET` | Secreto aleatorio estable de al menos 32 caracteres |
| `NEXT_PUBLIC_SITE_URL` | Origen HTTPS de TOCA, sin rutas |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Valores públicos del proyecto actual |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Valores de servidor del mismo proyecto |
| `ADMIN_USER_ID` | Administrador actual, sin cambios |

**Variable nueva:** `MERCADOPAGO_WEBHOOK_SECRET`, con la firma secreta que muestra la configuración de Webhooks de la aplicación del vendedor ficticio. No es el Access Token y no debes inventar su valor.

Ningún token ni clave secreta lleva `NEXT_PUBLIC_`. No necesitas Public Key para el checkout alojado. `CHECKOUT_BASE_URL` es opcional para un alias adicional al sitio y las URLs automáticas de Vercel.

Las variables de `.env.local` no se suben a Vercel. Después de guardar variables y publicar el código, despliega nuevamente. [Variables por entorno](https://vercel.com/docs/environment-variables).

## 4. Configurar Webhooks en Mercado Pago

En la **misma aplicación del vendedor de prueba que emite las suscripciones**, configura esta URL HTTPS:

`https://TU-DOMINIO/api/mercadopago/webhook`

Activa los eventos de **Pagos** y **Planes y suscripciones**:

- `payment`
- `subscription_preapproval`
- `subscription_authorized_payment`

Usa la configuración correspondiente a esa cuenta de prueba. No deduzcas el ambiente por el prefijo `APP_USR` del token: el servidor verifica que sea el vendedor ficticio esperado. Guarda su firma secreta en `MERCADOPAGO_WEBHOOK_SECRET` y vuelve a desplegar.

La URL debe ser accesible para Mercado Pago sin una sesión de Vercel. Si proteges el despliegue, configura una excepción específica para este endpoint; no publiques secretos de bypass en la página.

El endpoint valida `x-signature` y `x-request-id`, y contrasta el recurso firmado con el cuerpo. Luego consulta a Mercado Pago por API para comprobar vendedor, referencia, moneda, importe y pago aprobado. Una solicitud sin firma válida se rechaza; un simulador que no aporte un recurso real coincidente no puede crear NFC.

Los errores temporales devuelven 503 para permitir reintentos. La consulta automática desde TOCA usa la misma verificación y puede completar una asignación pendiente. Así el flujo no depende exclusivamente de que el comprador mantenga abierta la página.

Referencia: [Webhooks y firma](https://www.mercadopago.cl/developers/en/docs/checkout-pro-preferences/additional-content/notifications/webhooks).

## 5. Qué ocurre al aprobar el pago

El servidor llama una operación atómica que bloquea la compra, comprueba los datos verificados del pago y crea exactamente la cantidad contratada. Cada NFC tiene:

- Propietario: el usuario de TOCA que inició la compra.
- Nombre inicial: `NFC 1`, `NFC 2`, etc.
- Enlace único de TOCA y destino inicial `https://example.com`.
- Estado activo, editable desde el panel, con historial del destino inicial.
- Marca `is_test=true`, visible como **NFC de prueba**.

Si se repite una notificación o una consulta, no se crean unidades adicionales. Si falla una inserción, se revierte la operación completa. Las renovaciones tampoco vuelven a crear NFC.

**Mis compras** permite recuperar las últimas 50 compras desde otra sesión o navegador. Cada resultado está protegido por el usuario autenticado; conocer el ID de una compra no permite verla ni cancelarla desde otra cuenta.

Los NFC actuales de los usuarios no se reasignan ni se sustituyen. Un usuario puede realizar otra compra después de completarse la anterior, conservando sus suscripciones previas.

Esta etapa asigna los registros digitales y permite configurarlos; no graba ni entrega etiquetas físicas, ni emite documentos tributarios. El cierre por impago, devoluciones o vencimiento del período no está automatizado aquí: debe resolverse en la etapa de cobros reales. Cancelar la suscripción de prueba detiene sus renovaciones en Mercado Pago y conserva sus NFC de prueba.

## 6. Prueba completa

1. Aplica la migración, configura Auth/SMTP y Webhooks, y despliega.
2. Abre TOCA sin sesión, selecciona un plan y una cantidad (por ejemplo, 3).
3. Presiona **Crear cuenta y continuar**, usa un correo real al que tengas acceso y elige una contraseña. Introduce el código recibido; deben conservarse el plan y la cantidad.
4. Presiona **Suscribirme con Mercado Pago** y paga con el comprador y tarjeta ficticios.
5. Al regresar, espera la confirmación y **Tus 3 NFC están listos**. Entra al panel: deben existir exactamente 3 nuevos NFC, propios y dirigidos a `https://example.com`.
6. Recarga el resultado y vuelve desde **Mis compras**: deben seguir siendo los mismos 3. Verifica que otra cuenta no pueda abrir ese resultado ni editar esos NFC.
7. Prueba otra compra cerrando la pestaña después de confirmar en Mercado Pago: el webhook debe completar la asignación. Revisa su entrega en el panel de Mercado Pago y luego entra a TOCA.
8. Cancela las suscripciones de prueba para detener renovaciones. No borres registros para forzar reintentos; una respuesta incierta puede corresponder a una suscripción ya creada.

| Plan por NFC | Neto | IVA | Total |
| --- | ---: | ---: | ---: |
| Mensual | $2.200 | $418 | $2.618 |
| Anual (12 meses por el precio de 10) | $22.000 | $4.180 | $26.180 |

De 1 a 100 NFC por compra. El cálculo es lineal: 3 NFC cuestan $7.854 mensuales o $78.540 anuales con IVA. Los precios se calculan en el servidor y quedan guardados en la compra.

| Dato de Mercado Pago | Valor ficticio |
| --- | --- |
| Usuario comprador | `TESTUSER8501473770136902242` |
| Correo comprador | `test_user_8501473770136902242@testuser.com` |
| Código de verificación de esa cuenta | `192198` |
| Mastercard | `5416 7526 0258 2580` |
| Vencimiento / CVV | `11/30` / `123` |
| Titular | `APRO` |
| Documento, si se solicita | `Otro`, `123456789` |

No uses el correo ficticio de Mercado Pago para registrarte en TOCA: no podrás recibir el código de verificación de TOCA.

## Si algo falla

- **No llega el código:** revisa Confirm email, plantilla con `{{ .Token }}`, remitente SMTP, spam y límites de envío de Supabase. Puedes reenviarlo desde TOCA.
- **Correo confirmado pero sin perfil:** la cuenta queda en Auth; después de corregir la migración puedes iniciar sesión para completar el perfil sin registrarla otra vez.
- **Pago aprobado pero NFC pendientes:** la pantalla continúa reintentando. Revisa la migración, la actividad del usuario y los registros del webhook. No vuelvas a pagar esa misma compra.
- **Webhook 401:** verifica firma secreta, URL y aplicación del vendedor. No se aceptan notificaciones sin firma.
- **Webhook 503:** revisa configuración y disponibilidad de Supabase/Mercado Pago. La consulta desde Mis compras también permite reconciliar el resultado.
- **Pruebas anteriores a esta versión:** permanecen sin usuario asociado y no generan NFC. Para probar la asignación, inicia una compra nueva con sesión de TOCA.

La comprobación con registro, correo, pago y asignación reales del entorno de prueba requiere aplicar la migración y configurar los servicios; no se ejecuta automáticamente durante la revisión local del código.
