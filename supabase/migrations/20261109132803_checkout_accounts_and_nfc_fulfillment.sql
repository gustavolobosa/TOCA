begin;

-- Los intentos históricos siguen sin propietario: nunca se asignan por correo o cookie.
alter table public.checkout_test_attempts
  add column user_id uuid references public.profiles(id) on delete restrict,
  add column origin text,
  add column total_amount bigint,
  add column payment_id text unique,
  add column fulfilled_at timestamptz,
  add constraint checkout_owned_purchase check (
    user_id is null or (origin is not null and origin ~ '^https?://' and total_amount is not null and total_amount > 0)
  );
create index checkout_user_created on public.checkout_test_attempts(user_id, created_at desc);

alter table public.nfc_links
  add column checkout_purchase_id uuid references public.checkout_test_attempts(id) on delete restrict,
  add column checkout_unit integer,
  add column is_test boolean not null default false,
  add constraint nfc_checkout_unit check (
    (checkout_purchase_id is null and checkout_unit is null) or
    (checkout_purchase_id is not null and checkout_unit is not null and checkout_unit between 1 and 100)
  ),
  add constraint nfc_checkout_unit_unique unique(checkout_purchase_id, checkout_unit);

-- Solo el servidor llama esta función después de autenticar al usuario con Supabase.
create function public.ensure_customer_profile(target uuid, verified_email text) returns void
language plpgsql security invoker set search_path = '' as $$
declare customer_email text;
begin
  customer_email := lower(btrim(verified_email));
  if customer_email is null or length(customer_email) not between 3 and 254
     or customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Verified email required';
  end if;
  insert into public.profiles(id, name, email, is_admin, is_active, must_change_password)
  values(target, left(split_part(customer_email, '@', 1), 100), customer_email, false, true, false)
  on conflict (id) do nothing;
end;
$$;

-- El servidor verifica el pago por API antes de entrar aquí. El bloqueo serializa
-- webhook, consultas del navegador y reintentos; todas las unidades se crean juntas.
create function public.fulfill_checkout_test_purchase(
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

revoke all on function public.ensure_customer_profile(uuid,text),
  public.fulfill_checkout_test_purchase(uuid,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.ensure_customer_profile(uuid,text),
  public.fulfill_checkout_test_purchase(uuid,text,text,bigint,text) to service_role;

-- Añadir la marca al final conserva las columnas y permisos de la vista existente.
create or replace view public.nfc_link_summaries with (security_invoker=true) as
select n.id,n.owner_id,n.name,n.slug,n.destination_url,n.is_active,n.created_at,n.updated_at,
 count(e.id)::bigint as total_taps,max(e.created_at) as last_touched_at,
 n.destination_type,n.requires_configuration,n.is_test
from public.nfc_links n left join public.redirect_events e on e.nfc_link_id=n.id group by n.id;
commit;
