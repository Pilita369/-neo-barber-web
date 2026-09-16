import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Normaliza un teléfono a formato E.164. Para números argentinos, siempre
 * asume celular (agrega el "9" si falta) porque esta app solo identifica
 * clientes por WhatsApp — nunca hay líneas fijas involucradas, así que no
 * hace falta (ni conviene) distinguirlas. Devuelve null si no se puede
 * interpretar con confianza.
 */
export function toPhoneE164(input: string): string | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const parsed = parsePhoneNumberFromString(input, "AR");
  if (!parsed || !parsed.isValid()) return null;

  if (parsed.country !== "AR") {
    // No es un número argentino (alguien tipeó un código de país distinto
    // con el número completo) — no aplica la ambigüedad celular/fija de AR.
    return parsed.number;
  }

  let national = parsed.nationalNumber;
  if (national.startsWith("9")) national = national.slice(1);
  return `+549${national}`;
}
