# Actualización de visitas en vivo

El panel y el detalle de cada NFC escuchan inserciones en `public.redirect_events`
mediante Supabase Postgres Changes. La sesión del navegador y las políticas RLS
existentes determinan qué visitas puede recibir cada usuario. La suscripción
solicita solo `id` y `nfc_link_id`; no necesita permisos adicionales ni claves secretas.

Cada aviso solicita una actualización de los datos renderizados por el servidor.
Los avisos se agrupan durante 750 ms, sin consultas periódicas cuando no hay cambios.
Solo se ejecuta una actualización a la vez; los avisos recibidos mientras carga
dejan otra actualización pendiente. Las consultas se pausan cuando la pestaña
está oculta o sin conexión. La suscripción permanece abierta mientras la pantalla
está montada y se elimina al salir de ella.

Al completar la suscripción, reconectar, volver a la pestaña o recuperar internet,
se consultan nuevamente los datos para recuperar visitas que no se hayan recibido.
Un problema de suscripción muestra un aviso en la pantalla. El cliente Supabase
gestiona la reconexión del canal y la renovación de la sesión.

## Activación en Supabase

La migración `supabase/migrations/20261110184945_enable_visits_realtime.sql`
agrega únicamente `redirect_events` a la publicación `supabase_realtime`, si aún
no pertenece a ella. No cambia filas, funciones, políticas RLS ni permisos.
Requiere que exista la publicación estándar `supabase_realtime` de Supabase.

**La migración está preparada, pero no aplicada por esta implementación.**
El proyecto configurado en este checkout es `sixsesexcfklnaiqzlqm`.
Antes de aplicarla, verificar el destino y obtener aprobación explícita del usuario.

Consulta de lectura para comprobar la publicación:

```sql
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'redirect_events';
```

## Verificación manual después de la activación

Con visitas de prueba autorizadas, abrir el panel del propietario y el del
administrador, visitar un NFC y comprobar que sus cifras y gráficos se actualicen
sin recargar. Repetir desde el detalle del NFC. Verificar que otro propietario no
reciba el evento ni vea esa visita.

Comprobar también una ráfaga de visitas, una interrupción de internet y el regreso
a una pestaña oculta. Los filtros y el desplazamiento deben conservarse; los datos
deben recuperarse al volver. Al salir hacia una pantalla de edición, la suscripción
debe cerrarse.

## Límite de esta primera versión

Cada actualización reutiliza las consultas actuales del panel, incluidas las
agrupaciones de visitas. Medir tiempos y consumo si aumenta el tráfico, especialmente
en el panel administrativo. Agrupar actualizaciones reduce las consultas, pero no
los mensajes Realtime recibidos ni las conexiones de pestañas abiertas.
