import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normaliza un teléfono a formato E.164 usando Argentina como región por
 * defecto. Devuelve null si no se puede interpretar con confianza — nunca
 * fuerza un resultado dudoso.
 */
export function toPhoneE164(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input, "AR");
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}
