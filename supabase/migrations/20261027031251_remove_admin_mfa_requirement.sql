-- Retira solo la exigencia de segundo factor; conserva sesión, perfil y RLS.
begin;

create or replace function public.has_panel_access() returns boolean
language sql stable security invoker set search_path = '' as $$
 select exists (select 1 from public.profiles p where p.id = (select auth.uid())
  and p.is_active and not p.must_change_password
  and coalesce((auth.jwt()->>'iat')::bigint,0) >= p.token_valid_after);
$$;

commit;
