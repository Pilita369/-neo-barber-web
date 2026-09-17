-- Retroactive record of schema changes applied directly via the Supabase
-- SQL Editor on 2026-09-14/15 (superadmin role, staff_accounts,
-- needs_approval, and the create_appointment update that added
-- p_admin_created and the needs_approval logic — that function body is
-- fully re-defined by the next migration, so it isn't repeated here).
-- Guarded so this file is safe to run again against a database that
-- already has these — it must not fail if re-applied.

alter type public.app_role add value if not exists 'superadmin';

create table if not exists public.staff_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  whatsapp text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);
grant select on public.staff_accounts to authenticated;
grant all on public.staff_accounts to service_role;
alter table public.staff_accounts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'staff_accounts'
      and policyname = 'Superadmin gestiona accesos'
  ) then
    create policy "Superadmin gestiona accesos" on public.staff_accounts
      for all to authenticated
      using (public.has_role(auth.uid(), 'superadmin'))
      with check (public.has_role(auth.uid(), 'superadmin'));
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'staff_accounts'
      and policyname = 'Cada uno ve su propio acceso'
  ) then
    create policy "Cada uno ve su propio acceso" on public.staff_accounts
      for select to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

alter table public.appointments add column if not exists needs_approval boolean not null default false;
