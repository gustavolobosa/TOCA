-- Conserva las políticas RLS y los permisos de columnas existentes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'redirect_events'
  ) then
    alter publication supabase_realtime add table public.redirect_events;
  end if;
end;
$$;
