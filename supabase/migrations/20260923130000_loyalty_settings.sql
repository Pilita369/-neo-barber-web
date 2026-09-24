-- Regla de fidelizacion configurable desde el panel (antes era un numero fijo
-- en el codigo). "monthly" = visitas atendido dentro del mismo mes calendario;
-- "cumulative" = visitas atendido de todo el historico.
alter table public.business_settings
  add column loyalty_enabled boolean not null default true,
  add column loyalty_mode text not null default 'monthly'
    check (loyalty_mode in ('monthly', 'cumulative')),
  add column loyalty_visits_required integer not null default 3
    check (loyalty_visits_required > 0),
  add column loyalty_benefit_kind text not null default 'percent_20'
    check (loyalty_benefit_kind in ('percent_20', 'percent_50', 'free_cut'));
