begin;

alter table public.checkout_test_attempts
  add column renewal_status text,
  add column next_payment_at timestamptz;
alter table public.checkout_payments
  add column approved_at timestamptz,
  add column payment_method text;

-- El RPC anterior sigue disponible para los despliegues que ya están en ejecución.
create function public.record_billing_payment(
  purchase_id uuid, provider_subscription text, provider_payment text, provider_invoice text,
  paid_amount bigint, paid_currency text, payment_status text, refunded_amount numeric,
  provider_updated timestamptz, cycle_start timestamptz, approved_at timestamptz, payment_method text
) returns integer language plpgsql security invoker set search_path = '' as $$
declare units integer;
begin
  units := public.reconcile_checkout_payment(purchase_id, provider_subscription, provider_payment,
    provider_invoice, paid_amount, paid_currency, payment_status, refunded_amount, provider_updated, cycle_start);
  update public.checkout_payments p
    set approved_at = coalesce(p.approved_at, record_billing_payment.approved_at),
        payment_method = coalesce(p.payment_method, record_billing_payment.payment_method)
    where p.payment_id = provider_payment and p.purchase_id = record_billing_payment.purchase_id;
  return units;
end;
$$;

-- Usa todas las compras del titular. Las fechas se agrupan por día en Chile.
create function public.billing_overview(owner uuid)
returns table(nfc_count bigint, subscription_count bigint, next_at timestamptz, next_amount bigint, uncertain boolean)
language sql stable security invoker set search_path = '' as $$
  with purchases as (
    select * from public.checkout_test_attempts
    where user_id = owner and mode = 'production'
  ), scheduled as (
    select next_payment_at, total_amount, (next_payment_at at time zone 'America/Santiago')::date as day
    from purchases where state = 'ready' and renewal_status = 'authorized' and next_payment_at >= now()
  )
  select
    (select count(*) from public.nfc_links where owner_id = owner and not is_test and checkout_purchase_id is not null
      and not billing_blocked and billing_expires_at > now()),
    (select count(*) from purchases where fulfilled_at is not null and paid_until > now() and not billing_blocked),
    (select min(next_payment_at) from scheduled),
    (select sum(total_amount)::bigint from scheduled where day = (select min(day) from scheduled)),
    exists(select 1 from purchases where state = 'ready' and
      (renewal_status is null or (renewal_status = 'authorized' and (next_payment_at is null or next_payment_at < now()))));
$$;

revoke all on function public.billing_overview(uuid),
  public.record_billing_payment(uuid,text,text,text,bigint,text,text,numeric,timestamptz,timestamptz,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.billing_overview(uuid),
  public.record_billing_payment(uuid,text,text,text,bigint,text,text,numeric,timestamptz,timestamptz,timestamptz,text)
  to service_role;
commit;
