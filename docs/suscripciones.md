# Mis suscripciones

Aplicar primero `supabase/migrations/20261110220000_billing_dashboard.sql` sobre las migraciones de compras y promociones. La migración es compatible con la versión anterior de la aplicación. No requiere variables nuevas.

En `/panel/suscripciones`, el resumen cuenta los NFC adquiridos en producción que conservan su vigencia pagada, incluso después de cancelar una renovación. El próximo cobro suma las suscripciones que Mercado Pago tiene programadas para el mismo día en Chile. Las fechas se guardan al crear o conciliar la suscripción. Las compras antiguas pueden mostrar «Por confirmar» hasta recibir un evento o pasar por la conciliación existente.

**Comprar más NFC** abre una cotización de una suscripción adicional. El servidor valida el código y el total antes de continuar al checkout alojado de Mercado Pago. **Administrar** da acceso a pagos, detalle de compra y cancelación confirmada. Las compras canceladas sin vigencia y los intentos fallidos se pueden consultar en **Compras anteriores**.

**Historial de pagos** consulta los cobros reales de todas las suscripciones de la cuenta. Se puede abrir filtrado desde **Administrar**. En registros antiguos sin fecha de aprobación se identifica la fecha disponible como inicio del período. **Descargar comprobante** entrega un PDF privado por operación, incluyendo devoluciones y contracargos registrados. Para operaciones anteriores sin fecha de aprobación o medio de pago, el servidor consulta el pago original. El documento es un comprobante de TOCA, sin valor tributario.

Para probar tras publicar, abre una cuenta con un cobro real ya aprobado, descarga su comprobante y compara monto, período y referencia con Mercado Pago. Revisa también el historial filtrado en una pantalla pequeña. Puedes revisar una nueva compra y cerrar el diálogo antes de continuar a Mercado Pago.
