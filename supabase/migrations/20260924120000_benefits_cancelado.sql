-- Estado "cancelado" para beneficios (anulados por el admin sin haberse usado).
-- Aditivo: los beneficios existentes no se modifican. "Vencido" sigue sin
-- guardarse: se calcula como activo + valid_until pasada.
alter table public.benefits add column cancelled_at timestamptz;

alter table public.benefits drop constraint if exists benefits_status_check;
alter table public.benefits add constraint benefits_status_check
  check (status in ('activo', 'usado', 'cancelado'));

-- Un beneficio cancelado nunca figura como utilizado.
alter table public.benefits add constraint benefits_cancelado_sin_uso
  check (status <> 'cancelado' or used_at is null);
