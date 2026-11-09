begin;
alter table public.checkout_test_attempts
  add column quantity integer not null default 1
  constraint checkout_nfc_quantity_range check (quantity between 1 and 100);
comment on column public.checkout_test_attempts.quantity is 'Cantidad de NFC de la compra. Los intentos anteriores corresponden a una unidad.';
commit;
