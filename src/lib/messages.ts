import { fechaCorta } from "./datetime";
import { formatARS } from "./format";

/**
 * Mensaje de confirmacion de turno para WhatsApp. El recordatorio de precio
 * (y el alias, si esta cargado) solo se incluye cuando hay un precio real;
 * nunca se inventa un importe.
 */
export function buildTurnoConfirmationMessage({
  clientName,
  serviceName,
  date,
  time,
  price,
  paymentAlias,
  link,
}: {
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  price?: number | null | undefined;
  paymentAlias?: string | null | undefined;
  link?: string | undefined;
}): string {
  const firstName = clientName.trim().split(/\s+/)[0] || clientName;
  let msg = `Hola ${firstName} 👋 Tu turno en Neo Barbería quedó confirmado: ${serviceName}, ${fechaCorta(date)} a las ${time} h.`;
  if (price != null) {
    msg += ` Valor: ${formatARS(price)}.`;
    if (paymentAlias) msg += ` Alias para transferencia: ${paymentAlias}.`;
  }
  if (link) msg += ` Podés ver los detalles de tu turno acá: ${link}`;
  return msg;
}

/** Mensaje generico para enviar cualquier beneficio (fidelizacion, manual o voucher). */
export function buildBenefitWhatsAppMessage({
  clientName,
  title,
  big,
  message,
  link,
}: {
  clientName: string;
  title?: string | null;
  big: string;
  message?: string | null;
  link: string;
}): string {
  const firstName = clientName.trim().split(/\s+/)[0] || clientName;
  const intro = title?.trim() || "Tenemos un beneficio para vos";
  let msg = `¡Hola, ${firstName}! 💈 ${intro} en Neo Barbería: ${big}.`;
  if (message?.trim()) msg += ` ${message.trim()}`;
  msg += ` Podés verlo y reservar acá: ${link}`;
  return msg;
}
