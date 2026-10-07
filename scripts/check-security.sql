select jsonb_build_object(
  'whole_row_update', has_table_privilege('authenticated', 'public.nfc_links', 'UPDATE'),
  'can_change_slug', has_column_privilege('authenticated', 'public.nfc_links', 'slug', 'UPDATE'),
  'can_change_destination', has_column_privilege('authenticated', 'public.nfc_links', 'destination_url', 'UPDATE'),
  'foreign_keys', (select jsonb_agg(jsonb_build_object('name', conname, 'delete_action', confdeltype)) from pg_constraint where conrelid in ('public.nfc_links'::regclass, 'public.redirect_events'::regclass) and contype = 'f'),
  'policies', (select jsonb_agg(jsonb_build_object('table', tablename, 'command', cmd, 'using', qual, 'check', with_check)) from pg_policies where schemaname = 'public'),
  'nfc_count', (select count(*) from public.nfc_links),
  'event_count', (select count(*) from public.redirect_events),
  'migration_applied', exists(select 1 from supabase_migrations.schema_migrations where version = '20261006013618')
) as security_check;
