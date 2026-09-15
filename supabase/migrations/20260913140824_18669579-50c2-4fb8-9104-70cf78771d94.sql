create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Los usuarios ven sus roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.professionals to anon;
grant select, insert, update, delete on public.professionals to authenticated;
grant all on public.professionals to service_role;
alter table public.professionals enable row level security;
create policy "Publico lee profesionales activos" on public.professionals for select to anon using (active);
create policy "Admin gestiona profesionales" on public.professionals for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duration_min integer not null check (duration_min > 0),
  buffer_min integer not null default 0 check (buffer_min >= 0),
  price numeric(10,2),
  show_price boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.services to anon;
grant select, insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "Publico lee servicios activos" on public.services for select to anon using (active);
create policy "Admin gestiona servicios" on public.services for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  enabled boolean not null default true,
  start_time time not null default '10:00',
  end_time time not null default '20:00',
  break_start time,
  break_end time,
  slot_interval_min integer not null default 30 check (slot_interval_min > 0),
  unique (professional_id, weekday)
);
grant select on public.business_hours to anon;
grant select, insert, update, delete on public.business_hours to authenticated;
grant all on public.business_hours to service_role;
alter table public.business_hours enable row level security;
create policy "Publico lee horarios" on public.business_hours for select to anon using (true);
create policy "Admin gestiona horarios" on public.business_hours for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  date date not null,
  is_available boolean not null default false,
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz not null default now(),
  unique (professional_id, date)
);
grant select, insert, update, delete on public.availability_exceptions to authenticated;
grant all on public.availability_exceptions to service_role;
alter table public.availability_exceptions enable row level security;
create policy "Admin gestiona excepciones" on public.availability_exceptions for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  reason text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.time_blocks to authenticated;
grant all on public.time_blocks to service_role;
alter table public.time_blocks enable row level security;
create policy "Admin gestiona bloqueos" on public.time_blocks for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create type public.appointment_status as enum ('pendiente', 'confirmado', 'atendido', 'cancelado', 'no_asistio');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('NB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  token uuid not null unique default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id),
  service_id uuid not null references public.services(id),
  client_name text not null,
  client_lastname text not null,
  client_phone text not null,
  notes text,
  date date not null,
  start_time time not null,
  end_time time not null,
  status public.appointment_status not null default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.appointments to authenticated;
grant all on public.appointments to service_role;
alter table public.appointments enable row level security;
create policy "Admin gestiona turnos" on public.appointments for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create index appointments_prof_date_idx on public.appointments (professional_id, date);

create table public.business_settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'Neo Barbería',
  address text not null default 'Belgrano 3233, Neuquén Capital',
  whatsapp text not null default '5492996213688',
  welcome_text text not null default 'Reservá tu turno con David',
  share_text text not null default '💈 Reservá tu turno con David en Neo Barbería. Elegí el día y horario disponible desde acá:',
  instagram_url text,
  min_advance_hours integer not null default 2,
  max_days_ahead integer not null default 30,
  cancel_hours_limit integer not null default 4
);
grant select on public.business_settings to anon;
grant select, insert, update on public.business_settings to authenticated;
grant all on public.business_settings to service_role;
alter table public.business_settings enable row level security;
create policy "Publico lee configuracion" on public.business_settings for select to anon using (true);
create policy "Admin edita configuracion" on public.business_settings for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.create_appointment(
  p_professional_id uuid,
  p_service_id uuid,
  p_client_name text,
  p_client_lastname text,
  p_client_phone text,
  p_notes text,
  p_date date,
  p_start_time time,
  p_end_time time
) returns public.appointments language plpgsql security definer set search_path = public as $$
declare
  v_appt public.appointments;
begin
  perform pg_advisory_xact_lock(hashtext(p_professional_id::text || p_date::text));
  if exists (
    select 1 from public.appointments
    where professional_id = p_professional_id
      and date = p_date
      and status in ('pendiente', 'confirmado')
      and start_time < p_end_time and end_time > p_start_time
  ) then
    raise exception 'SLOT_TAKEN';
  end if;
  insert into public.appointments (professional_id, service_id, client_name, client_lastname, client_phone, notes, date, start_time, end_time)
  values (p_professional_id, p_service_id, p_client_name, p_client_lastname, p_client_phone, p_notes, p_date, p_start_time, p_end_time)
  returning * into v_appt;
  return v_appt;
end;
$$;
revoke all on function public.create_appointment(uuid, uuid, text, text, text, text, date, time, time) from public;
grant execute on function public.create_appointment(uuid, uuid, text, text, text, text, date, time, time) to service_role;

create or replace function public.claim_admin()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  if exists (select 1 from public.user_roles where role = 'admin') then
    return public.has_role(auth.uid(), 'admin');
  end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'admin')
  on conflict do nothing;
  return true;
end;
$$;
grant execute on function public.claim_admin() to authenticated;

insert into public.business_settings (id) values (1);
insert into public.professionals (name) values ('David');

insert into public.business_hours (professional_id, weekday, enabled, start_time, end_time, slot_interval_min)
select p.id, w, (w <> 0), '10:00', '20:00', 30
from public.professionals p, generate_series(0, 6) as w;

insert into public.services (name, description, duration_min, price, show_price, sort_order) values
  ('Corte', null, 45, null, false, 1),
  ('Corte y barba', null, 60, null, false, 2),
  ('Perfilado de barba', null, 30, null, false, 3);