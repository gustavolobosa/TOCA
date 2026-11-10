# Checkout local de suscripciones

Ejecuta `npm run dev -- --hostname 127.0.0.1` y abre
[la prueba](http://127.0.0.1:3000/prueba-pago).

El servidor usa `MERCADOPAGO_TEST_ACCESS_TOKEN` de `.env.local`. Debe pertenecer
al vendedor ficticio chileno de TOCA (3828192200). El correo del comprador está fijado a
`test_user_8501473770136902242@testuser.com`; el checkout invitado puede
asignarle un identificador de pagador distinto. No uses cuentas, tarjetas ni documentos reales.

1. Pulsa **Suscribirme con Mercado Pago**. Se crea una suscripción pendiente
   por $2.618 CLP mensuales y se abre el checkout oficial de Mercado Pago.
2. Con la sesión del comprador de prueba iniciada, elige la Mastercard
   terminada en 2580 (CVV `123` si se solicita) o **Nueva Tarjeta**. También
   puedes entrar con **Ingresar con mi cuenta** durante el checkout. Como
   invitado, elige **Sin cuenta de Mercado Pago → Tarjeta**. No se requiere
   incógnito ni cerrar sesión. La sesión debe ser del comprador de prueba,
   no de la empresa vendedora ni de una cuenta real.
3. Usa Mastercard `5416 7526 0258 2580`, vencimiento `11/30`, CVV `123`,
   titular `APRO`, documento **Otro**, número `123456789`.
4. Si pide correo, usa `test_user_8501473770136902242@testuser.com`.
5. Al volver a TOCA, el resultado se consulta automáticamente. Si abandonas
   el checkout, puedes recuperarlo con **Continuar en Mercado Pago** sin
   crear otra suscripción.
6. Al terminar, cancela la suscripción desde esta página.

Se envía como `back_url` la ruta local `/prueba-pago/retorno/<intento>`, sin
query string: Mercado Pago agrega su propio `?preapproval_id=...` al regresar.
Esa ruta valida el formato del intento y redirige a la página de resultado.
Este parámetro no otorga acceso ni confirma pagos. El servidor verifica el correo del pagador del pago, vendedor, monto,
moneda y referencia al consultar los recursos de Mercado Pago.

La página conserva la referencia en sessionStorage y también la recupera del
retorno. No confía en estados de pago de la URL. Consulta la API cada 3 a 30
segundos mientras esté pendiente, sin superponer consultas ni generar cobros.
La autorización de la suscripción y la aprobación del pago se muestran por
separado.

La página y su API están deshabilitadas en producción, Vercel y hosts no
locales. POST y DELETE requieren el mismo origen. La redirección solo admite
el dominio HTTPS oficial de Mercado Pago Chile y el checkout de la suscripción
creada. El Access Token permanece en el servidor. TOCA no recibe la tarjeta.

El bloqueo contra duplicados es local, en memoria; la recuperación después de
reiniciar consulta Mercado Pago por referencia. No ofrece idempotencia
distribuida. No incluye webhooks, activación del servicio, boletas ni escrituras
en la base de datos. Los intentos del antiguo formulario de tarjeta tienen una
referencia distinta y no se mezclan con este checkout.

## Verificación del 9 de noviembre de 2026

Se comprobó el pago con el comprador de prueba autenticado mediante su usuario
`TESTUSER8501473770136902242`, seleccionando la Mastercard ficticia guardada.
El inicio de sesión y la aprobación ocurren dentro de Mercado Pago; TOCA no
recibe la contraseña ni el código de verificación. Se revisó la aprobación
por la API y el resultado automático al volver a TOCA. Se completaron dos
recorridos: inicio de sesión dentro del checkout y apertura de un checkout
nuevo con esa sesión ya activa. Ambos pagos de $2.618 quedaron `approved /
accredited` y ambas suscripciones se cancelaron al terminar.

Evidencia: pagos `188630024204` y `188629455674`. En el primer recorrido se
solicitó CVV; en el segundo no fue necesario volver a ingresarlo. No se cambió
la API de cobro para obtener estos resultados ni se omitieron controles de
Mercado Pago.

La pantalla previamente mostrada con el botón deshabilitado no permitió
establecer una causa definitiva. No se debe afirmar que iniciar sesión sea
incompatible con el checkout, ni presentar incógnito como requisito del cliente.
Las pruebas no acreditan el funcionamiento con todas las cuentas reales ni
sustituyen la validación de producción.

Referencias oficiales:
- [Suscripciones pendientes sin plan](https://www.mercadopago.cl/developers/es/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments)
- [Crear suscripción](https://www.mercadopago.cl/developers/es/reference/online-payments/subscriptions/create-preapproval/post)
- [Tarjetas de prueba](https://www.mercadopago.cl/developers/es/docs/your-integrations/test/cards)
