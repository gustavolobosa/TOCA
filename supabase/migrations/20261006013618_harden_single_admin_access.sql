-- Épica 0. No modifica etiquetas, destinos, eventos ni cuentas existentes.
-- El UUID debe coincidir con ADMIN_USER_ID en todos los despliegues.
begin;

drop policy "El administrador puede leer sus enlaces" on public.nfc_links;
drop policy "El administrador puede crear sus enlaces" on public.nfc_links;
drop policy "El administrador puede actualizar sus enlaces" on public.nfc_links;
drop policy "El administrador puede leer eventos de sus enlaces" on public.redirect_events;

create policy "El administrador puede leer sus enlaces"
on public.nfc_links for select to authenticated
using ((select auth.uid()) = 'c8a7ce34-ca9c-4d20-b7d3-60279adc9812'::uuid and owner_id = (select auth.uid()));

create policy "El administrador puede crear sus enlaces"
on public.nfc_links for insert to authenticated
with check ((select auth.uid()) = 'c8a7ce34-ca9c-4d20-b7d3-60279adc9812'::uuid and owner_id = (select auth.uid()));

create policy "El administrador puede actualizar sus enlaces"
on public.nfc_links for update to authenticated
using ((select auth.uid()) = 'c8a7ce34-ca9c-4d20-b7d3-60279adc9812'::uuid and owner_id = (select auth.uid()))
with check ((select auth.uid()) = 'c8a7ce34-ca9c-4d20-b7d3-60279adc9812'::uuid and owner_id = (select auth.uid()));

create policy "El administrador puede leer eventos de sus enlaces"
on public.redirect_events for select to authenticated
using (
  (select auth.uid()) = 'c8a7ce34-ca9c-4d20-b7d3-60279adc9812'::uuid
  and exists (select 1 from public.nfc_links where nfc_links.id = redirect_events.nfc_link_id and nfc_links.owner_id = (select auth.uid()))
);

revoke update on public.nfc_links from authenticated;
grant update (name, destination_url, is_active) on public.nfc_links to authenticated;

alter table public.nfc_links drop constraint nfc_links_owner_id_fkey;
alter table public.nfc_links add constraint nfc_links_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete restrict;
alter table public.redirect_events drop constraint redirect_events_nfc_link_id_fkey;
alter table public.redirect_events add constraint redirect_events_nfc_link_id_fkey
  foreign key (nfc_link_id) references public.nfc_links(id) on delete restrict;

commit;
