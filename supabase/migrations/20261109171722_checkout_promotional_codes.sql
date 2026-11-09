begin;

create table public.checkout_promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  unit_net integer not null check (unit_net between 1 and 1000000),
  active boolean not null default true,
  expires_at timestamptz check (expires_at is null or isfinite(expires_at)),
  max_uses integer check (max_uses between 1 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.checkout_promotions enable row level security;
revoke all on public.checkout_promotions from public, anon, authenticated;
grant select, insert, update on public.checkout_promotions to service_role;

alter table public.checkout_test_attempts
  add column promo_id uuid references public.checkout_promotions(id) on delete restrict,
  add column promo_code text,
  add column unit_net integer check (unit_net between 1 and 1000000),
  add column promo_state text check (promo_state in ('reserved','consumed','released')),
  add column promo_expires_at timestamptz,
  add column promo_cancelled_at timestamptz,
  add constraint checkout_promotion_snapshot check (
    (promo_id is null and promo_code is null and promo_state is null and promo_expires_at is null) or
    (promo_id is not null and promo_code is not null and promo_state is not null and promo_expires_at is not null
      and user_id is not null and plan='mensual' and unit_net is not null and unit_net between 1 and 1000000
      and total_amount = round(unit_net::numeric * 119 / 100)::bigint * quantity)
  );
create unique index checkout_promo_customer on public.checkout_test_attempts(promo_id,user_id,mode)
  where promo_state in ('reserved','consumed');
create index checkout_promo_expiry on public.checkout_test_attempts(last_reconciled_at asc nulls first)
  where promo_state='reserved';

-- Consulta sin reserva. El INSERT posterior vuelve a validar bajo bloqueo del código.
create function public.quote_checkout_promotion(requested_code text, customer uuid, checkout_mode text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare promotion public.checkout_promotions;
begin
  if checkout_mode is null or checkout_mode not in ('test','production') or customer is null then raise exception 'promo_unavailable'; end if;
  select * into promotion from public.checkout_promotions where code=requested_code;
  if not found or not promotion.active or promotion.expires_at <= now() then raise exception 'promo_unavailable'; end if;
  if exists(select 1 from public.checkout_test_attempts where promo_id=promotion.id and user_id=customer
    and mode=checkout_mode and promo_state in ('reserved','consumed')) then raise exception 'promo_used'; end if;
  if promotion.max_uses is not null and (select count(*) from public.checkout_test_attempts where promo_id=promotion.id
    and mode=checkout_mode and promo_state in ('reserved','consumed')) >= promotion.max_uses then raise exception 'promo_full'; end if;
  return jsonb_build_object('id',promotion.id,'code',promotion.code,'unit_net',promotion.unit_net);
end; $$;
revoke all on function public.quote_checkout_promotion(text,uuid,text) from public,anon,authenticated;
grant execute on function public.quote_checkout_promotion(text,uuid,text) to service_role;

-- El bloqueo del catálogo serializa el último cupo entre compras simultáneas.
create function public.reserve_checkout_promotion() returns trigger
language plpgsql security invoker set search_path='' as $$
declare promotion public.checkout_promotions;
begin
  if new.promo_id is null then return new; end if;
  select * into promotion from public.checkout_promotions where id=new.promo_id for update;
  if exists(select 1 from public.checkout_test_attempts where id=new.id) then
    new.promo_state := 'reserved'; new.promo_expires_at := now() + interval '24 hours';
    return new;
  end if;
  if not found or not promotion.active or promotion.expires_at <= now() then raise exception 'promo_unavailable'; end if;
  if new.plan <> 'mensual' then raise exception 'promo_monthly'; end if;
  if new.promo_code is distinct from promotion.code or new.unit_net is distinct from promotion.unit_net
    or new.total_amount is distinct from round(promotion.unit_net::numeric * 119 / 100)::bigint * new.quantity then
    raise exception 'promo_changed';
  end if;
  perform 1 from public.profiles where id=new.user_id and is_active;
  if not found then raise exception 'promo_unavailable'; end if;
  if exists(select 1 from public.checkout_test_attempts where promo_id=promotion.id and user_id=new.user_id
    and mode=new.mode and promo_state in ('reserved','consumed')) then raise exception 'promo_used'; end if;
  if promotion.max_uses is not null and (select count(*) from public.checkout_test_attempts where promo_id=promotion.id
    and mode=new.mode and promo_state in ('reserved','consumed')) >= promotion.max_uses then raise exception 'promo_full'; end if;
  new.promo_state := 'reserved';
  new.promo_expires_at := now() + interval '24 hours';
  return new;
end; $$;
create trigger checkout_promotion_reservation before insert on public.checkout_test_attempts
  for each row execute function public.reserve_checkout_promotion();
revoke all on function public.reserve_checkout_promotion() from public,anon,authenticated;

-- Los importes de compras creadas no se recalculan cuando el administrador edita un código.
create function public.guard_checkout_promotion() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if (new.promo_id,new.promo_code,new.unit_net) is distinct from (old.promo_id,old.promo_code,old.unit_net)
    or (old.promo_id is not null and (new.total_amount,new.quantity,new.plan,new.user_id,new.mode)
      is distinct from (old.total_amount,old.quantity,old.plan,old.user_id,old.mode)) then
    raise exception 'Promotion snapshot is immutable';
  end if;
  if old.promo_state='consumed' and new.promo_state is distinct from 'consumed' then raise exception 'Consumed promotion is permanent'; end if;
  if old.promo_id is not null then
    if new.fulfilled_at is not null then new.promo_state := 'consumed'; end if;
    if new.state='failed' and new.subscription_id is null and new.promo_state='reserved' then new.promo_state := 'released'; end if;
    if new.state='cancelled' and new.promo_cancelled_at is null then new.promo_cancelled_at := now(); end if;
  end if;
  return new;
end; $$;
create trigger checkout_promotion_snapshot before update on public.checkout_test_attempts
  for each row execute function public.guard_checkout_promotion();
revoke all on function public.guard_checkout_promotion() from public,anon,authenticated;

-- Un pago reembolsado también prueba un uso previo, aunque su webhook approved llegara tarde.
create function public.consume_checkout_promotion() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.status in ('approved','refunded','charged_back') or new.refunded_amount > 0 then
    update public.checkout_test_attempts set promo_state='consumed'
    where id=new.purchase_id and promo_id is not null and promo_state <> 'consumed';
  end if;
  return new;
end; $$;
create trigger checkout_promotion_payment after insert or update on public.checkout_payments
  for each row execute function public.consume_checkout_promotion();
revoke all on function public.consume_checkout_promotion() from public,anon,authenticated;

-- El servidor solo llama tras cancelar en MP y comprobar TODOS los pagos, sin pendientes.
-- La espera permite reconciliar notificaciones que llegaron después de cancelar.
create function public.release_checkout_promotion(purchase_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  update public.checkout_test_attempts set promo_state='released'
  where id=purchase_id and promo_state='reserved' and fulfilled_at is null and state='cancelled'
    and promo_cancelled_at <= now() - interval '24 hours'
    and not exists(select 1 from public.checkout_payments p where p.purchase_id=release_checkout_promotion.purchase_id
      and (p.status not in ('rejected','cancelled') or p.refunded_amount > 0));
end; $$;
revoke all on function public.release_checkout_promotion(uuid) from public,anon,authenticated;
grant execute on function public.release_checkout_promotion(uuid) to service_role;

create function public.guard_promotion_edit() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.code <> old.code then raise exception 'Promotion code is immutable'; end if;
  if new.max_uses is not null and exists (
    select 1 from public.checkout_test_attempts where promo_id=old.id and promo_state in ('reserved','consumed')
    group by mode having count(*) > new.max_uses
  ) then raise exception 'promo_limit_below_usage'; end if;
  new.updated_at := now();
  return new;
end; $$;
create trigger checkout_promotion_edit before update on public.checkout_promotions
  for each row execute function public.guard_promotion_edit();
revoke all on function public.guard_promotion_edit() from public,anon,authenticated;

-- Solo se consulta desde el servidor después de requireAdmin(). Sin acceso del navegador.
create view public.checkout_promotion_summary with (security_invoker=true) as
select p.*, coalesce(p.expires_at <= now(), false) as expired, count(a.id) filter(where a.mode='production' and a.promo_state='consumed') as used,
  count(a.id) filter(where a.mode='production' and a.promo_state='reserved') as reserved,
  count(a.id) filter(where a.mode='test' and a.promo_state='consumed') as test_used,
  count(a.id) filter(where a.mode='test' and a.promo_state='reserved') as test_reserved
from public.checkout_promotions p left join public.checkout_test_attempts a on a.promo_id=p.id group by p.id;
revoke all on public.checkout_promotion_summary from public,anon,authenticated;
grant select on public.checkout_promotion_summary to service_role;

create function public.save_checkout_promotion(actor uuid, promotion_id uuid, requested_code text,
  price integer, enabled boolean, expiry_date date, usage_limit integer) returns void
language plpgsql security invoker set search_path='' as $$
declare expiry timestamptz;
begin
  perform public.assert_admin(actor);
  if expiry_date is not null then expiry := (expiry_date + interval '1 day') at time zone 'America/Santiago'; end if;
  if promotion_id is null then
    insert into public.checkout_promotions(code,unit_net,active,expires_at,max_uses)
    values(requested_code,price,enabled,expiry,usage_limit);
  else
    update public.checkout_promotions set code=requested_code,unit_net=price,active=enabled,expires_at=expiry,max_uses=usage_limit
    where id=promotion_id;
    if not found then raise exception 'Promotion not found'; end if;
  end if;
end; $$;
revoke all on function public.save_checkout_promotion(uuid,uuid,text,integer,boolean,date,integer) from public,anon,authenticated;
grant execute on function public.save_checkout_promotion(uuid,uuid,text,integer,boolean,date,integer) to service_role;

insert into public.checkout_promotions(code,unit_net) values ('TOCA1300',1300),('TOCA1000',1000);
notify pgrst, 'reload schema';
commit;
