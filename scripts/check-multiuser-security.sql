-- Solo lectura. Usar después de aplicar la migración autorizada.
select jsonb_build_object(
 'migration_applied', exists(select 1 from supabase_migrations.schema_migrations where version='20261006015536'),
 'counts', jsonb_build_object(
   'nfc', (select count(*) from public.nfc_links),
   'events', (select count(*) from public.redirect_events),
   'profiles', (select count(*) from public.profiles),
   'history', (select count(*) from public.nfc_destination_history)),
 'admins', (select count(*) from public.profiles where is_admin),
 'rls', (select jsonb_agg(jsonb_build_object('table',c.relname,'enabled',c.relrowsecurity))
   from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname in ('profiles','nfc_links','redirect_events','nfc_destination_history','admin_events')),
 'policies', (select jsonb_agg(jsonb_build_object('table',tablename,'command',cmd,'using',qual))
   from pg_policies where schemaname='public'),
 'authenticated_privileges', jsonb_build_object(
   'insert_nfc',has_table_privilege('authenticated','public.nfc_links','INSERT'),
   'update_nfc',has_table_privilege('authenticated','public.nfc_links','UPDATE'),
   'change_destination',has_column_privilege('authenticated','public.nfc_links','destination_url','UPDATE'),
   'change_owner',has_column_privilege('authenticated','public.nfc_links','owner_id','UPDATE'),
   'change_profile',has_table_privilege('authenticated','public.profiles','UPDATE'),
   'forge_events',has_table_privilege('authenticated','public.redirect_events','INSERT'),
   'read_user_agent',has_column_privilege('authenticated','public.redirect_events','user_agent','SELECT'),
   'forge_history',has_table_privilege('authenticated','public.nfc_destination_history','INSERT'),
   'read_admin_audit',has_table_privilege('authenticated','public.admin_events','SELECT')),
 'rpc_permissions', (select jsonb_agg(jsonb_build_object(
   'name',p.proname,'security_definer',p.prosecdef,'search_path',p.proconfig,
   'anon_can_call',has_function_privilege('anon',p.oid,'EXECUTE'),
   'authenticated_can_call',has_function_privilege('authenticated',p.oid,'EXECUTE'),
   'service_can_call',has_function_privilege('service_role',p.oid,'EXECUTE')))
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
   and p.proname in ('assert_admin','register_profile','set_profile_active','complete_password_change','create_nfc','update_nfc','reassign_nfc','resolve_nfc')),
 'view_options', (select jsonb_agg(jsonb_build_object('name',relname,'options',reloptions))
   from pg_class where oid in ('public.nfc_link_summaries'::regclass,'public.nfc_daily_stats'::regclass)),
 'restrict_foreign_keys', (select jsonb_agg(jsonb_build_object('name',conname,'delete_action',confdeltype,'validated',convalidated))
   from pg_constraint where contype='f' and conrelid in ('public.nfc_links'::regclass,'public.redirect_events'::regclass,
   'public.nfc_destination_history'::regclass,'public.admin_events'::regclass,'public.profiles'::regclass))
) as multiuser_security_check;
