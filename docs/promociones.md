# Códigos promocionales de TOCA

## Qué está incluido

- Solo compras mensuales nuevas, de 1 a 100 NFC. Un código por compra.
- Precio neto por NFC configurado por el administrador; precio con IVA redondeado por unidad al peso y multiplicado por cantidad. El precio permanece durante toda la suscripción.
- `TOCA1300`: $1.300 netos, $247 IVA, $1.547 por NFC/mes.
- `TOCA1000`: $1.000 netos, $190 IVA, $1.190 por NFC/mes.
- Ambos se crean activos, sin vencimiento ni máximo total de usos.
- Un uso por cuenta de TOCA y código. No se identifica por RUT; otra cuenta con otro correo es otro usuario.
- El primer pago aprobado consume definitivamente el uso. Cancelar, reembolsar o recibir un contracargo no lo devuelve. Si el primer estado recibido ya es una devolución o contracargo, también se considera consumido.
- Las pruebas usan la misma base y catálogo, pero sus usos y cupos se contabilizan por separado de producción.
- Editar/desactivar/vencer un código afecta compras futuras; un checkout ya creado conserva su monto y reserva. Los nombres de códigos son permanentes: se desactivan, no se borran ni renombran.
- El plan anual conserva su precio normal y no admite códigos.

## 1. Ejecutar la migración (usuario)

En el proyecto habitual de Supabase → SQL Editor → New query, pega y ejecuta completo:

`supabase/migrations/20261109171722_checkout_promotional_codes.sql`

Requiere las migraciones anteriores, incluida producción `20261109152816_checkout_production_billing.sql`. No vuelvas a ejecutar migraciones ya aplicadas. El archivo es transaccional; si falla, no publiques hasta resolverlo. La migración agrega un catálogo privado, columnas de precio/reserva en las compras, restricciones, funciones y triggers; no modifica importes ni asignaciones existentes. Incluye ambos códigos iniciales. **Codex no ejecutó esta migración en ninguna base.**

Después puedes comprobar solo con lecturas:

```sql
select code, unit_net, active, expires_at, max_uses, used, reserved, test_used, test_reserved
from public.checkout_promotion_summary order by code;
```

Deben aparecer los dos códigos activos, precios 1300 y 1000, límites y vencimientos nulos, conteos en cero.

## 2. Variables y publicación (usuario)

**No hay nuevas variables de ambiente, cambios de SMTP ni cambios de Webhooks.** Conserva las credenciales y `TOCA_CHECKOUT_MODE` que ya funcionan. Las promociones se administran en Supabase mediante el panel, no en Mercado Pago ni en `.env`.

Mantén `CRON_SECRET` y la tarea existente `/api/cron/checkout` en Vercel. La revisión sigue siendo diaria, compatible con la frecuencia configurada actualmente; no se agregó otro cron. No borres el token de prueba si quedan reservas ficticias por revisar.

Desde la raíz de TOCA, revisa y publica únicamente los archivos de esta tarea:

```bash
cd /Users/gustavolobos/proyectos/TOCA
git status --short
git diff --check
git add app/api/checkout/route.ts app/api/cron/checkout/route.ts app/comprar/checkout.tsx app/comprar/page.module.css app/cuenta/compras/page.tsx app/panel/promociones/actions.ts app/panel/promociones/page.tsx components/panel-navigation.tsx lib/checkout/mercadopago.ts lib/checkout/session.ts lib/checkout/store.ts lib/checkout/promotions.ts supabase/migrations/20261109171722_checkout_promotional_codes.sql docs/checkout.md docs/promociones.md
git diff --cached --stat
git commit -m "Agrega códigos promocionales para suscripciones mensuales"
git push origin main
```

Espera que Vercel muestre **Ready** para ese commit. No agregues `.env.local`, `output/`, `.playwright-mcp/` ni la página local no versionada `app/prueba-pago/` a este commit.

## 3. Comprobar la administración

1. Entra con la cuenta administradora y abre `/panel/promociones` (también aparece en el menú).
2. Comprueba que existan TOCA1300 y TOCA1000 con sus precios correctos.
3. Los campos vacíos de fecha o máximo significan sin límite.
4. El vencimiento incluye todo el día seleccionado, en hora de Santiago de Chile, incluyendo cambio de horario.
5. Para detener nuevas compras, desmarca «Disponible para nuevas compras» y guarda.
6. El máximo cuenta compras, no NFC, e incluye reservas pendientes. No puedes bajarlo debajo del total reservado y consumido en cualquiera de los dos modos; puedes desactivar el código.
7. El precio neto admite enteros entre $1 y $1.000.000. Puede ser mayor al precio normal; comprueba el valor antes de guardar. Solo se muestra ahorro cuando el precio es menor al normal.

## 4. Prueba completa de una compra

Si conservas `TOCA_CHECKOUT_MODE=production`, **la confirmación en Mercado Pago realiza una compra real y autoriza renovaciones**. Puedes verificar aplicar/quitar códigos y precios sin confirmar el pago. Para una compra ficticia completa usa `test` con sus credenciales y redeploy; ese cambio afecta a todos los clientes que intenten comprar en ese deployment.

1. Entra con una cuenta cliente verificada y sin otro checkout pendiente. La cuenta compradora de Mercado Pago debe ser distinta del vendedor.
2. Desde Precios elige mensual y 2 NFC.
3. Sin código debes ver $4.400 netos + $836 IVA = **$5.236/mes**.
4. Escribe `toca1300` y presiona **Aplicar**. Debe normalizarse a `TOCA1300`: $2.600 netos + $494 IVA = **$3.094/mes**.
5. Cambia a 3 NFC: $3.900 netos + $741 IVA = **$4.641/mes**. Cambia nuevamente a 2 para continuar.
6. Quita el código: vuelve a $5.236. Aplica TOCA1000: $2.000 netos + $380 IVA = **$2.380/mes**.
7. Elige cuál quieres pagar y presiona **Suscribirme con Mercado Pago**. El monto mensual en Mercado Pago debe coincidir exactamente con TOCA.
8. Completa el pago. Regresa y espera la confirmación automática; no hace falta consultar manualmente.
9. Revisa **Mis compras**: debe mostrar código, precio, pago y dos NFC asignados. En `/panel`, comprueba dos NFC nuevos a tu nombre con destino `https://example.com`.
10. Recarga la página: no deben aparecer más NFC ni otro uso consumido. El administrador debe ver un uso consumido y cero reservados para esa compra.
11. Desde una nueva compra de la misma cuenta, aplica ese mismo código: debe rechazarse. El otro código sigue siendo utilizable una vez.
12. Si fue una prueba real, cancela la renovación desde Mis compras cuando termines. Cancelar no devuelve el cobro ni recupera el código.

Consultas opcionales de verificación (solo lectura):

```sql
select a.id, p.email, a.mode, a.promo_code, a.unit_net, a.quantity,
       a.total_amount, a.promo_state, a.state, a.payment_id, a.fulfilled_at,
       a.paid_until, count(n.id) as nfc_asignados,
       coalesce(bool_and(n.destination_url = 'https://example.com'), false) as destino_inicial
from public.checkout_test_attempts a
join public.profiles p on p.id = a.user_id
left join public.nfc_links n on n.checkout_purchase_id = a.id
where a.promo_id is not null
group by a.id, p.email
order by a.created_at desc
limit 20;
```

El destino puede cambiar legítimamente después de configurarlo en el panel. La asignación se comprueba por compra, no por cantidad total histórica del usuario.

## 5. Restricciones y reintentos

- **Código inexistente:** muestra un error, no cambia el precio ni permite continuar con un código escrito sin aplicar.
- **Plan anual:** sin campo promocional; un envío manipulado al servidor también se rechaza.
- **Código desactivado/vencido:** rechaza nuevos checkouts. Una compra ya creada conserva su contrato.
- **Cambio de precio entre aplicar y pagar:** se detiene antes de crear el cobro; quitar y volver a aplicar muestra el nuevo precio.
- **Cupo máximo:** crea un código adicional, por ejemplo `PRUEBACUPO`, con máximo 1. Con dos cuentas diferentes aplica el código antes de pagar. Al abrir el primer checkout queda reservado; el segundo no debe poder crear otra suscripción con ese código. Aplicar solamente no reserva cupo.
- **Pago fallido:** no consume el código definitivamente. Puedes reintentar el mismo checkout; para empezar otro, cancela el anterior y espera la liberación segura si tenía reserva.
- **Editar/desactivar después de una compra:** Mis compras conserva precio y código; las renovaciones siguen con el monto original de Mercado Pago. Una renovación real requiere esperar su fecha de cobro para comprobarla de extremo a extremo.
- **Acceso:** un cliente no administrador no puede entrar en `/panel/promociones` ni ejecutar sus acciones. El catálogo, el resumen y las funciones no se exponen a roles `anon` o `authenticated`.

## 6. Reservas abandonadas y límites operativos

Una reserva se crea al iniciar Mercado Pago, no al aplicar el código. Después de 24 horas el cron intenta cancelar las suscripciones que aún estén `pending`. Las autorizadas o con pago en procesamiento conservan la reserva; se concilian hasta resolver el pago. Una creación cuyo resultado sea incierto también conserva la reserva para evitar duplicar suscripciones cobrables.

Después de confirmar la cancelación se espera **al menos otras 24 horas**. Luego se consultan todas las facturas y la búsqueda de pagos de la referencia, comprobando recursos individuales. Solo se libera si no quedan pagos aprobados, devueltos, con contracargo, pendientes ni estados desconocidos. Si Mercado Pago falla o el historial está incompleto, se conserva el cupo. Nunca se vuelve a enviar automáticamente la creación de la suscripción.

Con cron diario, la liberación no es inmediata y puede tardar varios días. El lote procesa hasta 10 reservas vencidas y hasta 20 compras de producción por ejecución, rotando por fecha de revisión; a mayor volumen se requiere mayor frecuencia/capacidad. El cron puede cancelar checkouts promocionales pendientes abandonados, pero no devuelve pagos ni cancela suscripciones autorizadas por antigüedad.

No liberes reservas editando SQL a mano: podrías dejar un checkout cobrable y ofrecer el mismo cupo a otra persona. La espera reduce el riesgo de datos tardíos del proveedor; ante estados inciertos el flujo mantiene la reserva.

## Verificación realizada durante la implementación

Se revisan tipos, lint, compilación, los tests existentes y la sintaxis de SQL/PL/pgSQL. No se agregan tests automatizados. Esto no reemplaza ejecutar la migración y completar las comprobaciones de pago en el deployment: la concurrencia real, los permisos en Supabase y las renovaciones quedan pendientes de esa validación.
