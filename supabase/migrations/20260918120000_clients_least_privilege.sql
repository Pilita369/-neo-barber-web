-- Least privilege for public.clients.
--
-- Panel reads use the admin's own JWT, gated by RLS. anon and authenticated
-- get no write access through the API; writes go through create_appointment
-- (security definer) or the service role, whose privileges are left unchanged.

revoke all on public.clients from anon, authenticated;
grant select on public.clients to authenticated;

drop policy if exists "Admin lee clientes" on public.clients;
create policy "Admin lee clientes" on public.clients
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
