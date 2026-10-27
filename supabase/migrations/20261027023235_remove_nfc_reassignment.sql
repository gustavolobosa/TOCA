-- Retira la operación de reasignación sin modificar propietarios ni historial.
-- Conserva requires_configuration para etiquetas pendientes de configuración.
drop function if exists public.reassign_nfc(uuid, bigint, uuid);
