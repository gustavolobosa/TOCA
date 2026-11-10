# Suscripciones y pagos

## Publicación

No requiere migraciones nuevas ni variables de ambiente. Utiliza `checkout_test_attempts` y `checkout_payments`, con las migraciones de producción y promociones ya existentes. No vuelvas a ejecutarlas si ya están aplicadas.

La pantalla está en `/panel/suscripciones`, dentro del panel y accesible desde el menú para administradores y clientes. `/cuenta/compras` redirige a esta pantalla, por lo que los enlaces anteriores siguen funcionando.

## Comportamiento

- Cada cuenta ve únicamente sus propias compras, con paginación de 10 suscripciones y 10 pagos por página del historial.
- Muestra plan, cantidad de NFC, importe total con IVA, código promocional, fecha de contratación y vigencia pagada.
- Consulta automáticamente Mercado Pago para mostrar estado de renovación y `next_payment_date` cuando esté disponible. No calcula una supuesta fecha de cobro a partir de `paid_until`.
- Distingue suscripción activa, renovación pausada/cancelada, pendiente de pago, período pagado y servicio suspendido. Un pago confirmado por sí solo no demuestra que la renovación siga activa.
- Las consultas GET de billing son de lectura: no crean cobros, no asignan NFC y no escriben en Supabase. Los webhooks y la conciliación existentes actualizan pagos y vigencia. Mientras la compra está pendiente se vuelve a consultar cada 30 segundos en una pestaña visible; también existe actualización manual.
- Si Mercado Pago falla, conserva los datos guardados, muestra un aviso y mantiene la posibilidad de solicitar la cancelación de una suscripción conocida.
- La cancelación requiere confirmación explícita en un diálogo. POST valida origen, sesión activa y propiedad de la compra; el cliente no proporciona un ID de Mercado Pago, propietario ni importe.
- Se reutiliza `cancelCheckout`, que ahora comprueba también el estado de la respuesta de cancelación antes de guardarla. No devuelve dinero ni elimina NFC. Conserva el período pagado; los cobros que ya estuvieran en procesamiento pueden completarse.
- El historial corresponde a cobros reales registrados en TOCA. No es una boleta ni factura tributaria. Para compras ficticias se enlaza al detalle de la compra; no se inventa un historial de cobros reales.

## Verificación después de publicar

1. Espera el estado Ready del deployment y entra con una cuenta cliente que tenga compras.
2. Abre **Suscripciones**. Verifica cantidades, precio promocional, IVA, vigencia y próximo cobro cuando Mercado Pago lo entregue.
3. Expande **Historial de pagos** y compara las referencias con los pagos del proveedor. Si aún no hay registros, verifica el resultado de compra y los webhooks existentes.
4. Pulsa **Cancelar renovación** y luego **Conservar suscripción**: la renovación debe seguir igual.
5. Cuando quieras cancelar realmente una suscripción, abre el diálogo y confirma. Debe quedar **Cancelada**, sin próximo cobro, conservando el período pagado. Una cancelación real no debe usarse como una comprobación visual; el diálogo por sí solo se puede revisar sin confirmar.
6. Recarga y comprueba que la cancelación siga visible. Comprueba también su estado en Mercado Pago.
7. Prueba desde un teléfono: plan, precio, fechas, acciones e historial deben ser legibles. El historial ancho permite desplazamiento dentro de la tabla.
8. Con una cuenta sin compras debe aparecer la invitación a elegir un plan. Con otra cuenta solo deben verse las compras de esa cuenta.
9. `/cuenta/compras` debe llevar a la nueva pantalla. Las suscripciones antiguas siguen accesibles mediante la paginación.

## Comprobaciones de implementación

Tipos, lint, compilación y los tests automatizados existentes. Revisión visual en escritorio y móvil con datos ficticios, incluido el diálogo y su foco inicial. No se agregaron tests automatizados, migraciones ni dependencias. No se hicieron cobros, cancelaciones reales ni escrituras de base de datos para verificar esta tarea; la prueba con cuentas reales queda para el deployment.

Referencia del proveedor: [consulta de suscripción y próximo cobro](https://www.mercadopago.cl/developers/es/reference/online-payments/subscriptions/get-preapproval/get).
