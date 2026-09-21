-- Beneficios de fidelizacion (Etapa 6). Cada beneficio pertenece a UN cliente,
-- tiene un token publico unico (UUID) y un estado. "Vencido" no se guarda: se
-- calcula como estado activo + valid_until pasada.
create table public.benefits (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  kind text not null check (kind in ('percent_20', 'percent_50', 'free_cut')),
  status text not null default 'activo' check (status in ('activo', 'usado')),
  valid_until date not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  used_at timestamptz
);
create index benefits_client_id_idx on public.benefits (client_id);

-- Sin acceso para anon. El admin solo lee (politica); las escrituras y la
-- lectura publica por token pasan por el servidor con service_role.
revoke all on public.benefits from anon, authenticated;
grant select on public.benefits to authenticated;
grant all on public.benefits to service_role;
alter table public.benefits enable row level security;
create policy "Admin lee beneficios" on public.benefits
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Un beneficio solo puede estar asociado a un turno a la vez. Al cancelar o
-- marcar "no asistio" el servidor pone benefit_id en null y lo libera.
alter table public.appointments add column benefit_id uuid references public.benefits(id);
create unique index appointments_one_benefit
  on public.appointments (benefit_id) where benefit_id is not null;
