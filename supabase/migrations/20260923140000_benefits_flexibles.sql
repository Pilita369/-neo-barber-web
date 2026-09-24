-- Beneficios flexibles (manuales) y vouchers/regalo. Aditivo: los beneficios
-- existentes (percent_20, percent_50, free_cut) siguen funcionando igual,
-- estas columnas quedan en null para ellos.
alter table public.benefits
  add column title text,
  add column message text,
  add column service_id uuid references public.services(id),
  add column discount_percent numeric check (discount_percent > 0 and discount_percent < 100),
  add column discount_amount numeric check (discount_amount > 0);

alter table public.benefits drop constraint if exists benefits_kind_check;
alter table public.benefits add constraint benefits_kind_check
  check (kind in ('percent_20', 'percent_50', 'free_cut', 'percent_custom', 'amount_off', 'prepaid_gift'));
