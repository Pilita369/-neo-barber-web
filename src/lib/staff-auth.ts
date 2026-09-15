const EMAIL_DOMAIN = "neobarberia.internal";

/** Deja solo dígitos: "299 615-2272" -> "2996152272" */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Mapea un WhatsApp a un email sintético para usar el login por email+contraseña de Supabase Auth por debajo. */
export function phoneToEmail(phone: string): string {
  return `wa+${normalizePhone(phone)}@${EMAIL_DOMAIN}`;
}
