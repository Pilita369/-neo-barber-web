create table public.clients (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique,
  name text not null,
  lastname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.clients to service_role;
alter table public.clients enable row level security;
-- Sin políticas públicas todavía: todo el acceso pasa por service_role en
-- servidor, igual que appointments hoy. Se agrega una política admin-only
-- cuando el panel necesite leerla con el JWT del staff (Etapa 3).

alter table public.appointments add column client_id uuid references public.clients(id);
create index appointments_client_id_idx on public.appointments (client_id);

drop function if exists public.create_appointment(uuid, uuid, text, text, text, text, date, time, time, boolean);

create or replace function public.create_appointment(
  p_professional_id uuid,
  p_service_id uuid,
  p_client_name text,
  p_client_lastname text,
  p_client_phone text,
  p_notes text,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_admin_created boolean default false,
  p_phone_e164 text default null
) returns public.appointments language plpgsql security definer set search_path = public as $$
declare
  v_appt public.appointments;
  v_needs_approval boolean := false;
  v_client_id uuid := null;
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
  if not p_admin_created and exists (
    select 1 from public.appointments
    where client_phone = p_client_phone
      and status in ('pendiente', 'confirmado')
  ) then
    v_needs_approval := true;
  end if;
  if p_phone_e164 is not null then
    insert into public.clients (phone_e164, name, lastname)
    values (p_phone_e164, p_client_name, p_client_lastname)
    on conflict (phone_e164) do update set updated_at = now()
    returning id into v_client_id;
  end if;
  insert into public.appointments (
    professional_id, service_id, client_name, client_lastname, client_phone,
    notes, date, start_time, end_time, needs_approval, client_id
  )
  values (
    p_professional_id, p_service_id, p_client_name, p_client_lastname, p_client_phone,
    p_notes, p_date, p_start_time, p_end_time, v_needs_approval, v_client_id
  )
  returning * into v_appt;
  return v_appt;
end;
$$;
revoke all on function public.create_appointment(uuid, uuid, text, text, text, text, date, time, time, boolean, text) from public, anon, authenticated;
grant execute on function public.create_appointment(uuid, uuid, text, text, text, text, date, time, time, boolean, text) to service_role;
