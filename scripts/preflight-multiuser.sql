-- Solo lectura. Ejecutar antes de proponer/aplicar la migración multiusuario.
select jsonb_build_object(
 'base_migration_applied', exists(select 1 from supabase_migrations.schema_migrations where version='20261006013618'),
 'multiuser_migration_applied', exists(select 1 from supabase_migrations.schema_migrations where version='20261006015536'),
 'admin_exists', exists(select 1 from auth.users where id='c8a7ce34-ca9c-4d20-b7d3-60279adc9812'::uuid and email is not null),
 'nfc_count', (select count(*) from public.nfc_links),
 'event_count', (select count(*) from public.redirect_events),
 'other_legacy_owners', (select count(*) from public.nfc_links where owner_id<>'c8a7ce34-ca9c-4d20-b7d3-60279adc9812'::uuid),
 'legacy_destination_requiring_review', (select count(*) from public.nfc_links where
   char_length(destination_url)>2048 or destination_url ~ '[[:space:][:cntrl:]]'
   or destination_url !~ '^https://([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+([A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})(/|\?|#|$)'
   or destination_url ~* '^https://([^/]+\.)?(localhost|local|internal|test|invalid)(/|\?|#|$)'
   or destination_url ~* '^https://toca-one\.vercel\.app(/|\?|#|$)'),
 'service_can_update_nfc', has_table_privilege('service_role','public.nfc_links','UPDATE'),
 'service_can_insert_event', has_table_privilege('service_role','public.redirect_events','INSERT')
) as preflight;
