-- Pendiente de aprobación. No altera contraseñas ni elimina datos existentes.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  email text not null unique check (char_length(email) between 3 and 254),
  is_active boolean not null default true,
  is_admin boolean not null default false,
  must_change_password boolean not null default true,
  token_valid_after bigint not null default 0,
  created_at timestamptz not null default now(),
  constraint only_known_admin check (not is_admin or id = 'c8a7ce34-ca9c-4d20-b7d3-60279adc9812'::uuid)
);
create unique index profiles_single_admin on public.profiles(is_admin) where is_admin;
insert into public.profiles(id, name, email, is_admin)
select id, 'Administrador', email, true from auth.users
where id = 'c8a7ce34-ca9c-4d20-b7d3-60279adc9812'::uuid;

alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated
using (id = (select auth.uid()));
-- Listar cuentas usa la operación administrativa de servidor; no amplía RLS.

create function public.has_panel_access() returns boolean
language sql stable security invoker set search_path = '' as $$
 select exists (select 1 from public.profiles p where p.id = (select auth.uid())
  and p.is_active and not p.must_change_password
  and coalesce((auth.jwt()->>'iat')::bigint,0) >= p.token_valid_after
  and (not p.is_admin or (select auth.jwt()->>'aal') = 'aal2'));
$$;

alter table public.nfc_links add column destination_type text not null default 'generic'
  check (destination_type in ('instagram','whatsapp','google_review','generic'));
alter table public.nfc_links add column requires_configuration boolean not null default false;
alter table public.redirect_events add column destination_type text not null default 'unknown'
  check (destination_type in ('instagram','whatsapp','google_review','generic','unknown'));
alter table public.nfc_links add constraint nfc_links_profile_fkey
  foreign key(owner_id) references public.profiles(id) on delete restrict not valid;

create table public.nfc_destination_history (
 id bigint generated always as identity primary key,
 nfc_link_id bigint not null references public.nfc_links(id) on delete restrict,
 destination_url text not null,
 destination_type text not null check (destination_type in ('instagram','whatsapp','google_review','generic','unknown')),
 created_at timestamptz not null default now()
);
create index nfc_history_link_created_idx on public.nfc_destination_history(nfc_link_id, created_at desc, id desc);
-- Los eventos antiguos no permiten reconstruir cambios sin visitas: no inventarlos.
insert into public.nfc_destination_history(nfc_link_id,destination_url,destination_type,created_at)
select nfc_link_id,destination_url,'unknown',min(created_at)
from public.redirect_events group by nfc_link_id,destination_url;
insert into public.nfc_destination_history(nfc_link_id,destination_url,destination_type,created_at)
select id,destination_url,destination_type,updated_at from public.nfc_links;

create table public.admin_events (
 id bigint generated always as identity primary key,
 actor_id uuid not null references public.profiles(id) on delete restrict,
 action text not null,
 target_user_id uuid references public.profiles(id) on delete restrict,
 nfc_link_id bigint references public.nfc_links(id) on delete restrict,
 previous_owner_id uuid references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now()
);
alter table public.nfc_destination_history enable row level security;
alter table public.admin_events enable row level security;

drop policy "El administrador puede leer sus enlaces" on public.nfc_links;
drop policy "El administrador puede crear sus enlaces" on public.nfc_links;
drop policy "El administrador puede actualizar sus enlaces" on public.nfc_links;
drop policy "El administrador puede leer eventos de sus enlaces" on public.redirect_events;
create policy nfc_read on public.nfc_links for select to authenticated using (
 (select public.has_panel_access()) and (owner_id = (select auth.uid()) or
 (select auth.uid()) = 'c8a7ce34-ca9c-4d20-b7d3-60279adc9812'::uuid)
);
create policy events_read on public.redirect_events for select to authenticated using (
 exists (select 1 from public.nfc_links n where n.id = nfc_link_id)
);
create policy history_read on public.nfc_destination_history for select to authenticated using (
 exists (select 1 from public.nfc_links n where n.id = nfc_link_id)
);

-- Ni siquiera un propietario puede escribir directamente o falsificar historial.
revoke all on public.profiles, public.nfc_destination_history, public.admin_events from public, anon, authenticated;
revoke all on public.nfc_links, public.redirect_events from public, anon, authenticated;
revoke update(name,destination_url,is_active) on public.nfc_links from authenticated;
grant select on public.profiles, public.nfc_links, public.nfc_destination_history to authenticated;
grant select(id,nfc_link_id,destination_url,destination_type,created_at) on public.redirect_events to authenticated;
grant select, insert, update on public.profiles, public.nfc_destination_history, public.admin_events to service_role;
grant usage, select on sequence public.nfc_destination_history_id_seq, public.admin_events_id_seq to service_role;

-- Agregar destination_type al final conserva la forma anterior de la vista.
create or replace view public.nfc_link_summaries with (security_invoker=true) as
select n.id,n.owner_id,n.name,n.slug,n.destination_url,n.is_active,n.created_at,n.updated_at,
 count(e.id)::bigint as total_taps,max(e.created_at) as last_touched_at,n.destination_type,n.requires_configuration
from public.nfc_links n left join public.redirect_events e on e.nfc_link_id=n.id group by n.id;
create view public.nfc_daily_stats with (security_invoker=true) as
select nfc_link_id,(created_at at time zone 'America/Santiago')::date as day,destination_type,count(*)::bigint as visits
from public.redirect_events group by nfc_link_id,day,destination_type;
revoke all on public.nfc_daily_stats from public, anon;
grant select on public.nfc_daily_stats to authenticated, service_role;

-- Comprobaciones DB para destinos nuevos. La aplicación también valida el origen TOCA configurado.
create function public.valid_nfc_destination(kind text, value text) returns boolean
language sql immutable security invoker set search_path='' as $$
 select char_length(value) <= 2048
 and value !~ '[[:space:][:cntrl:]]'
 and value ~ '^https://([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+([A-Za-z]{2,63}|xn--[A-Za-z0-9-]{1,59})(/|\?|#|$)'
 and value !~* '^https://([^/]+\.)?(localhost|local|internal|test|invalid)(/|\?|#|$)'
 and value !~* '^https://toca-one\.vercel\.app(/|\?|#|$)'
 and case kind
 when 'instagram' then (value ~ '^https://www\.instagram\.com/[a-z0-9_][a-z0-9_.]{0,28}[a-z0-9_]/$' or value ~ '^https://www\.instagram\.com/[a-z0-9_]/$') and value !~ '\.\.'
 when 'whatsapp' then value ~ '^https://wa\.me/[1-9][0-9]{7,14}$'
 when 'google_review' then value ~ '^https://g\.page/(r/)?[A-Za-z0-9_-]+/review/?(\?[^#]*)?$' or value ~ '^https://search\.google\.com/local/writereview\?([^#]*&)?placeid=[A-Za-z0-9_-]{5,256}(&[^#]*)?$'
 when 'generic' then true else false end;
$$;
alter table public.nfc_links add constraint nfc_valid_destination
check (public.valid_nfc_destination(destination_type,destination_url)) not valid;

-- Solo service_role puede llamar estas funciones, todas SECURITY INVOKER.
-- La sesión/AAL se verifica en cada Server Action; el actor jamás viene del formulario.
create function public.assert_admin(actor uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.profiles p where p.id=actor and p.is_admin and p.is_active and not p.must_change_password)
 then raise exception 'Not authorized' using errcode='42501'; end if;
end; $$;

create function public.register_profile(actor uuid, target uuid, display_name text, target_email text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform public.assert_admin(actor);
 insert into public.profiles(id,name,email) values(target,display_name,lower(target_email));
 insert into public.admin_events(actor_id,action,target_user_id) values(actor,'user_created',target);
end; $$;

create function public.set_profile_active(actor uuid, target uuid, active boolean) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform public.assert_admin(actor);
 perform 1 from public.profiles where id=target and not is_admin for update;
 if not found then raise exception 'Invalid account'; end if;
 update public.profiles set is_active=active where id=target;
 if not active then update public.nfc_links set is_active=false where owner_id=target; end if;
 insert into public.admin_events(actor_id,action,target_user_id)
 values(actor,case when active then 'user_enabled' else 'user_disabled' end,target);
end; $$;

create function public.complete_password_change(actor uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 -- Auth cambia la clave y revoca todas las sesiones ANTES de esta operación.
 -- Ceil excluye incluso JWT anteriores emitidos en el mismo segundo.
 update public.profiles set must_change_password=false,
 token_valid_after=ceil(extract(epoch from clock_timestamp()))::bigint where id=actor and is_active;
 if not found then raise exception 'Account not active'; end if;
end; $$;

create function public.create_nfc(actor uuid, target uuid, title text, tag_slug text, kind text, url text) returns bigint
language plpgsql security invoker set search_path='' as $$
declare tag_id bigint;
begin
 perform public.assert_admin(actor);
 perform 1 from public.profiles where id=target and is_active for share;
 if not found then raise exception 'Account not active'; end if;
 insert into public.nfc_links(owner_id,name,slug,destination_type,destination_url)
 values(target,title,tag_slug,kind,url) returning id into tag_id;
 insert into public.nfc_destination_history(nfc_link_id,destination_type,destination_url) values(tag_id,kind,url);
 insert into public.admin_events(actor_id,action,target_user_id,nfc_link_id) values(actor,'nfc_created',target,tag_id);
 return tag_id;
end; $$;

create function public.update_nfc(actor uuid, tag_id bigint, title text, kind text, url text, active boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare tag public.nfc_links; owner uuid;
begin
 select owner_id into owner from public.nfc_links where id=tag_id;
 -- Bloquear cuenta antes que etiqueta mantiene el mismo orden que desactivar/reasignar.
 perform 1 from public.profiles where id in (actor,owner) and is_active and (id<>actor or not must_change_password) order by id for share;
 if not exists(select 1 from public.profiles where id=actor and is_active and not must_change_password)
 or not exists(select 1 from public.profiles where id=owner and is_active) then raise exception 'Account not active'; end if;
 select * into tag from public.nfc_links where id=tag_id for update;
 if not found or tag.owner_id<>owner or (actor<>tag.owner_id and actor<>'c8a7ce34-ca9c-4d20-b7d3-60279adc9812'::uuid)
 then raise exception 'Not authorized' using errcode='42501'; end if;
 if tag.destination_url<>url or tag.destination_type<>kind then
  insert into public.nfc_destination_history(nfc_link_id,destination_url,destination_type) values(tag_id,url,kind);
 elsif tag.requires_configuration and active then raise exception 'Configure a new destination before activating';
 end if;
 update public.nfc_links set name=title,destination_type=kind,destination_url=url,is_active=active,
 requires_configuration=tag.requires_configuration and tag.destination_url=url and tag.destination_type=kind where id=tag_id;
end; $$;

create function public.reassign_nfc(actor uuid, tag_id bigint, target uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare previous uuid;
begin
 perform public.assert_admin(actor);
 select owner_id into previous from public.nfc_links where id=tag_id;
 perform 1 from public.profiles where id in (previous,target) order by id for share;
 if not exists(select 1 from public.profiles where id=target and is_active) then raise exception 'Account not active'; end if;
 perform 1 from public.nfc_links where id=tag_id and owner_id=previous for update;
 if not found or previous=target then raise exception 'Invalid transfer'; end if;
 update public.nfc_links set owner_id=target,is_active=false,requires_configuration=true where id=tag_id;
 insert into public.admin_events(actor_id,action,target_user_id,nfc_link_id,previous_owner_id)
 values(actor,'nfc_reassigned',target,tag_id,previous);
end; $$;

create function public.resolve_nfc(tag_slug text, record_visit boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare tag public.nfc_links; owner uuid; recorded boolean:=false;
begin
 select owner_id into owner from public.nfc_links where slug=tag_slug;
 perform 1 from public.profiles where id=owner and is_active for share;
 if not found then return null; end if;
 select * into tag from public.nfc_links where slug=tag_slug and owner_id=owner and is_active and not requires_configuration for share;
 if not found then return null; end if;
 if record_visit then
  begin
   insert into public.redirect_events(nfc_link_id,destination_url,destination_type) values(tag.id,tag.destination_url,tag.destination_type);
   recorded:=true;
  exception when others then recorded:=false;
  end;
 end if;
 return jsonb_build_object('destination_url',tag.destination_url,'destination_type',tag.destination_type,'recorded',recorded);
end; $$;

revoke all on function public.has_panel_access(), public.valid_nfc_destination(text,text) from public, anon;
grant execute on function public.has_panel_access() to authenticated;
grant execute on function public.valid_nfc_destination(text,text) to service_role;
revoke all on function public.assert_admin(uuid), public.register_profile(uuid,uuid,text,text),
 public.set_profile_active(uuid,uuid,boolean), public.complete_password_change(uuid),
 public.create_nfc(uuid,uuid,text,text,text,text), public.update_nfc(uuid,bigint,text,text,text,boolean),
 public.reassign_nfc(uuid,bigint,uuid), public.resolve_nfc(text,boolean) from public, anon, authenticated;
grant execute on function public.assert_admin(uuid), public.register_profile(uuid,uuid,text,text),
 public.set_profile_active(uuid,uuid,boolean), public.complete_password_change(uuid),
 public.create_nfc(uuid,uuid,text,text,text,text), public.update_nfc(uuid,bigint,text,text,text,boolean),
 public.reassign_nfc(uuid,bigint,uuid), public.resolve_nfc(text,boolean) to service_role;

commit;
