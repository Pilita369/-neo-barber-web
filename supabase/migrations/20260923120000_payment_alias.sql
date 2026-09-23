-- Alias de pago opcional, para incluirlo en el recordatorio de WhatsApp junto
-- al servicio y el precio. Nullable: si no se carga, el recordatorio no lo
-- menciona.
alter table public.business_settings add column payment_alias text;
