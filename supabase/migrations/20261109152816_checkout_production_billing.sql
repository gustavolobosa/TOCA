begin;

-- El nombre histórico se conserva para no mover compras ni cambiar sus identificadores.
alter table public.checkout_test_attempts
  add column mode text not null default 'test' check (mode in ('test','production')),
  add column buyer_email text,
  add column paid_until timestamptz,
  add column billing_blocked boolean not null default false,
  add column last_reconciled_at timestamptz,
  add constraint checkout_live_buyer check (mode = 'test' or (buyer_email is not null and length(buyer_email) between 3 and 254));
create index checkout_reconciliation on public.checkout_test_attempts(last_reconciled_at asc nulls first)
  where mode = 'production' and state <> 'failed';

alter table public.nfc_links
  add column billing_expires_at timestamptz,
  add column billing_blocked boolean not null default false;

create table public.checkout_payments (
  payment_id text primary key check (payment_id ~ '^[0-9]+$'),
  purchase_id uuid not null references public.checkout_test_attempts(id) on delete restrict,
  invoice_id text not null,
  status text not null,
  refunded_amount numeric not null check (refunded_amount >= 0),
  provider_updated_at timestamptz not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  updated_at timestamptz not null default now(),
  check (period_end > period_start)
);
create index checkout_payments_purchase on public.checkout_payments(purchase_id);
alter table public.checkout_payments enable row level security;
revoke all on public.checkout_payments from public, anon, authenticated;
grant select, insert, update on public.checkout_payments to service_role;

-- Solo recibe datos que el servidor ha contrastado con la API y la factura de la suscripción.
-- La compra se bloquea antes del pago para serializar renovaciones y notificaciones repetidas.
create function public.reconcile_checkout_payment(
  purchase_id uuid, provider_subscription text, provider_payment text, provider_invoice text,
  paid_amount bigint, paid_currency text, payment_status text, refunded_amount numeric,
  provider_updated timestamptz, cycle_start timestamptz
) returns integer
language plpgsql security invoker set search_path = '' as $$
declare purchase public.checkout_test_attempts; tag_id bigint; unit integer;
  expiry timestamptz; blocked boolean; existing public.checkout_payments;
begin
  select * into purchase from public.checkout_test_attempts where id = purchase_id for update;
  if not found or purchase.user_id is null or purchase.mode <> 'production' then raise exception 'Owned production purchase required'; end if;
  if provider_subscription is null or purchase.subscription_id is distinct from provider_subscription
     or purchase.total_amount is distinct from paid_amount or paid_currency is distinct from 'CLP'
     or provider_payment is null or provider_payment !~ '^[0-9]+$'
     or provider_invoice is null or provider_invoice !~ '^[0-9]+$'
     or payment_status is null or refunded_amount is null or refunded_amount < 0 or refunded_amount > paid_amount
     or provider_updated is null or not isfinite(provider_updated) or provider_updated > now() + interval '5 minutes'
     or cycle_start is null or not isfinite(cycle_start) or cycle_start > now() + interval '1 day' then
    raise exception 'Payment does not match purchase';
  end if;
  select * into existing from public.checkout_payments where payment_id = provider_payment;
  if found then
    if existing.purchase_id <> purchase.id or existing.invoice_id <> provider_invoice then raise exception 'Payment already assigned'; end if;
    if existing.provider_updated_at > provider_updated then return purchase.quantity; end if;
    -- Ante timestamps iguales una devolución/contracargo nunca se revierte por un approved repetido.
    if existing.provider_updated_at = provider_updated and
      (existing.refunded_amount > refunded_amount or (existing.status in ('refunded','charged_back') and payment_status = 'approved')) then
      return purchase.quantity;
    end if;
  end if;
  insert into public.checkout_payments(payment_id,purchase_id,invoice_id,status,refunded_amount,provider_updated_at,period_start,period_end)
  values(provider_payment,purchase.id,provider_invoice,payment_status,refunded_amount,provider_updated,cycle_start,
    ((cycle_start at time zone 'UTC') + make_interval(months => case when purchase.plan='anual' then 12 else 1 end)) at time zone 'UTC')
  on conflict (payment_id) do update set status=excluded.status, refunded_amount=excluded.refunded_amount,
    provider_updated_at=excluded.provider_updated_at, updated_at=now()
  where public.checkout_payments.purchase_id=excluded.purchase_id;
  if not found then raise exception 'Payment already assigned'; end if;

  select max(p.period_end) filter (where p.status='approved' and p.refunded_amount=0),
    coalesce(bool_or(p.status='charged_back'),false)
  into expiry,blocked from public.checkout_payments p where p.purchase_id=purchase.id;

  if purchase.fulfilled_at is null and payment_status='approved' and refunded_amount=0 then
    perform 1 from public.profiles where id=purchase.user_id and is_active for share;
    if not found then raise exception 'Account not active'; end if;
    for unit in 1..purchase.quantity loop
      insert into public.nfc_links(owner_id,name,slug,destination_type,destination_url,is_active,requires_configuration,
        checkout_purchase_id,checkout_unit,is_test,billing_expires_at,billing_blocked)
      values(purchase.user_id,'NFC ' || unit,replace(gen_random_uuid()::text,'-',''),'generic','https://example.com',
        true,false,purchase.id,unit,false,expiry,blocked)
      returning id into tag_id;
      insert into public.nfc_destination_history(nfc_link_id,destination_type,destination_url)
      values(tag_id,'generic','https://example.com');
    end loop;
    update public.checkout_test_attempts set payment_id=provider_payment,fulfilled_at=now() where id=purchase.id;
  end if;
  update public.checkout_test_attempts set paid_until=expiry,billing_blocked=blocked,last_reconciled_at=now() where id=purchase.id;
  -- No se modifica la pausa elegida por el cliente. El acceso requiere además la vigencia del pago.
  update public.nfc_links set billing_expires_at=coalesce(expiry,'epoch'::timestamptz),billing_blocked=blocked
  where checkout_purchase_id=purchase.id;
  return purchase.quantity;
end;
$$;
revoke all on function public.reconcile_checkout_payment(uuid,text,text,text,bigint,text,text,numeric,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.reconcile_checkout_payment(uuid,text,text,text,bigint,text,text,numeric,timestamptz,timestamptz) to service_role;

create or replace function public.fulfill_checkout_test_purchase(
  purchase_id uuid, provider_subscription text, provider_payment text,
  paid_amount bigint, paid_currency text
) returns integer
language plpgsql security invoker set search_path = '' as $$
declare purchase public.checkout_test_attempts; tag_id bigint; unit integer;
begin
  select * into purchase from public.checkout_test_attempts where id = purchase_id for update;
  if not found or purchase.user_id is null then raise exception 'Owned purchase required'; end if;
  if provider_subscription is null or purchase.subscription_id is null
     or purchase.subscription_id is distinct from provider_subscription
     or purchase.total_amount is distinct from paid_amount
     or paid_currency is distinct from 'CLP'
     or provider_payment is null or provider_payment !~ '^[0-9]+$' then
    raise exception 'Payment does not match purchase';
  end if;
  if purchase.mode <> 'test' then raise exception 'Test purchase required'; end if;
  if purchase.fulfilled_at is not null then return purchase.quantity; end if;
  perform 1 from public.profiles where id = purchase.user_id and is_active for share;
  if not found then raise exception 'Account not active'; end if;
  for unit in 1..purchase.quantity loop
    insert into public.nfc_links(owner_id, name, slug, destination_type, destination_url,
      is_active, requires_configuration, checkout_purchase_id, checkout_unit, is_test)
    values(purchase.user_id, 'NFC ' || unit, replace(gen_random_uuid()::text, '-', ''),
      'generic', 'https://example.com', true, false, purchase.id, unit, true)
    returning id into tag_id;
    insert into public.nfc_destination_history(nfc_link_id, destination_type, destination_url)
    values(tag_id, 'generic', 'https://example.com');
  end loop;
  update public.checkout_test_attempts set payment_id = provider_payment, fulfilled_at = now()
  where id = purchase.id;
  return purchase.quantity;
end;
$$;


-- La vigencia se verifica al escanear: no depende de que un cron cambie is_active.
create or replace function public.resolve_nfc(tag_slug text, record_visit boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare tag public.nfc_links; owner uuid; recorded boolean:=false;
begin
 select owner_id into owner from public.nfc_links where slug=tag_slug;
 perform 1 from public.profiles where id=owner and is_active for share;
 if not found then return null; end if;
 select * into tag from public.nfc_links where slug=tag_slug and owner_id=owner
   and is_active and not requires_configuration and not billing_blocked
   and (billing_expires_at is null or billing_expires_at > now()) for share;
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

create or replace view public.nfc_link_summaries with (security_invoker=true) as
select n.id,n.owner_id,n.name,n.slug,n.destination_url,n.is_active,n.created_at,n.updated_at,
 count(e.id)::bigint as total_taps,max(e.created_at) as last_touched_at,
 n.destination_type,n.requires_configuration,n.is_test,n.billing_expires_at,n.billing_blocked,
 (not n.billing_blocked and (n.billing_expires_at is null or n.billing_expires_at > now())) as billing_active
from public.nfc_links n left join public.redirect_events e on e.nfc_link_id=n.id group by n.id;
commit;
