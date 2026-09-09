drop policy "El administrador puede leer sus enlaces" on public.nfc_links;
drop policy "El administrador puede crear sus enlaces" on public.nfc_links;
drop policy "El administrador puede actualizar sus enlaces" on public.nfc_links;
drop policy "El administrador puede leer eventos de sus enlaces" on public.redirect_events;

create policy "El administrador puede leer sus enlaces"
on public.nfc_links
for select
to authenticated
using (
  (select auth.uid()) = owner_id
  and (select auth.jwt() ->> 'email') = 'gustaolobosas@gmail.com'
);

create policy "El administrador puede crear sus enlaces"
on public.nfc_links
for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and (select auth.jwt() ->> 'email') = 'gustaolobosas@gmail.com'
);

create policy "El administrador puede actualizar sus enlaces"
on public.nfc_links
for update
to authenticated
using (
  (select auth.uid()) = owner_id
  and (select auth.jwt() ->> 'email') = 'gustaolobosas@gmail.com'
)
with check (
  (select auth.uid()) = owner_id
  and (select auth.jwt() ->> 'email') = 'gustaolobosas@gmail.com'
);

create policy "El administrador puede leer eventos de sus enlaces"
on public.redirect_events
for select
to authenticated
using (
  (select auth.jwt() ->> 'email') = 'gustaolobosas@gmail.com'
  and exists (
    select 1
    from public.nfc_links
    where nfc_links.id = redirect_events.nfc_link_id
      and nfc_links.owner_id = (select auth.uid())
  )
);
