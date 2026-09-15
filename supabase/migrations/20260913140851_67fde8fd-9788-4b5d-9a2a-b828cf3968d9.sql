revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.create_appointment(uuid, uuid, text, text, text, text, date, time, time) from public, anon, authenticated;
revoke all on function public.claim_admin() from public, anon;
alter function public.has_role(uuid, public.app_role) set search_path = public;
alter function public.create_appointment(uuid, uuid, text, text, text, text, date, time, time) set search_path = public;
alter function public.claim_admin() set search_path = public;