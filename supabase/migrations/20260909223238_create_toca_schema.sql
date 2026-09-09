create table public.nfc_links (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  slug text not null unique check (slug ~ '^[A-Za-z0-9_-]{8,32}$'),
  destination_url text not null check (destination_url ~ '^https://'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index nfc_links_owner_id_idx on public.nfc_links (owner_id);

create table public.redirect_events (
  id bigint generated always as identity primary key,
  nfc_link_id bigint not null references public.nfc_links (id) on delete cascade,
  destination_url text not null,
  user_agent text check (user_agent is null or char_length(user_agent) <= 512),
  created_at timestamptz not null default now()
);

create index redirect_events_link_created_at_idx
  on public.redirect_events (nfc_link_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger nfc_links_set_updated_at
before update on public.nfc_links
for each row execute function public.set_updated_at();

alter table public.nfc_links enable row level security;
alter table public.redirect_events enable row level security;

create policy "El administrador puede leer sus enlaces"
on public.nfc_links
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "El administrador puede crear sus enlaces"
on public.nfc_links
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "El administrador puede actualizar sus enlaces"
on public.nfc_links
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "El administrador puede leer eventos de sus enlaces"
on public.redirect_events
for select
to authenticated
using (
  exists (
    select 1
    from public.nfc_links
    where nfc_links.id = redirect_events.nfc_link_id
      and nfc_links.owner_id = (select auth.uid())
  )
);

create view public.nfc_link_summaries
with (security_invoker = true)
as
select
  nfc_links.id,
  nfc_links.owner_id,
  nfc_links.name,
  nfc_links.slug,
  nfc_links.destination_url,
  nfc_links.is_active,
  nfc_links.created_at,
  nfc_links.updated_at,
  count(redirect_events.id)::bigint as total_taps,
  max(redirect_events.created_at) as last_touched_at
from public.nfc_links
left join public.redirect_events
  on redirect_events.nfc_link_id = nfc_links.id
group by nfc_links.id;

revoke all on table public.nfc_links from anon;
revoke all on table public.redirect_events from anon;
revoke all on table public.nfc_link_summaries from anon;

grant select, insert, update on table public.nfc_links to authenticated;
grant select on table public.redirect_events to authenticated;
grant select on table public.nfc_link_summaries to authenticated;
grant usage, select on sequence public.nfc_links_id_seq to authenticated;

grant select, insert, update on table public.nfc_links to service_role;
grant select, insert on table public.redirect_events to service_role;
grant select on table public.nfc_link_summaries to service_role;
grant usage, select on sequence public.nfc_links_id_seq to service_role;
grant usage, select on sequence public.redirect_events_id_seq to service_role;

revoke all on function public.set_updated_at() from public;
