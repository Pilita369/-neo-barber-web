-- Least privilege for public.clients.
--
-- Panel reads use the admin's own JWT, gated by RLS. Nobody writes through the
-- API: the only writers are create_appointment (security definer, runs as the
-- function owner, so it needs no grant here) and the service-role backfill
-- script (select + insert only).

revoke all on public.clients from anon, authenticated;
grant select on public.clients to authenticated;

drop policy if exists "Admin lee clientes" on public.clients;
create policy "Admin lee clientes" on public.clients
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

revoke all on public.clients from service_role;
grant select, insert on public.clients to service_role;
