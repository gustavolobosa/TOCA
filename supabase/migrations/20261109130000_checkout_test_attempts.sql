-- Aplicar en el Supabase actual de TOCA. Los intentos ficticios tienen su propia tabla.
begin;
create table public.checkout_test_attempts (
  id uuid primary key,
  plan text not null check (plan in ('mensual', 'anual')),
  subscription_id text unique,
  state text not null default 'creating' check (state in ('creating', 'ready', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint checkout_subscription_required check (state not in ('ready', 'cancelled') or subscription_id is not null)
);
alter table public.checkout_test_attempts enable row level security;
revoke all on public.checkout_test_attempts from public, anon, authenticated;
grant select, insert, update on public.checkout_test_attempts to service_role;
comment on table public.checkout_test_attempts is 'Reserva duradera de intentos ficticios. Solo accesible desde el servidor; no activa cuentas ni NFC.';
commit;
