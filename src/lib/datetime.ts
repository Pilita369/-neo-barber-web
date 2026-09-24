export const TZ = "America/Argentina/Buenos_Aires";

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Fecha de hoy en Buenos Aires: yyyy-mm-dd */
export function todayBA(): string {
  return dateFmt.format(new Date());
}

/** Hora actual en Buenos Aires: HH:mm */
export function nowTimeBA(): string {
  return timeFmt.format(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Día de la semana (0=domingo) para una fecha yyyy-mm-dd */
export function weekdayOf(dateStr: string): number {
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}

/** Primer y último día de un mes (1-12) en formato "yyyy-mm-dd". */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

/** "HH:mm" o "HH:mm:ss" -> minutos desde medianoche */
export function timeToMin(t: string): number {
  const parts = t.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

/** minutos desde medianoche -> "HH:mm" */
export function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Normaliza "HH:mm:ss" -> "HH:mm" */
export function normTime(t: string): string {
  return t.slice(0, 5);
}

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIAS_CORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** (2026, 9) -> "Septiembre 2026" */
export function nombreMes(year: number, month: number): string {
  const nombre = MESES[month - 1] ?? "";
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${year}`;
}

/** "2026-09-14" -> "lunes 14 de septiembre" */
export function fechaLarga(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const wd = weekdayOf(dateStr);
  return `${(DIAS[wd] ?? "").toLowerCase()} ${d} de ${MESES[m - 1] ?? ""} de ${y}`;
}

/** "2026-09-14" -> "lunes 14 de septiembre" (sin año) */
export function fechaCorta(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  const wd = weekdayOf(dateStr);
  return `${(DIAS[wd] ?? "").toLowerCase()} ${d} de ${MESES[m - 1] ?? ""}`;
}

export function diaCorto(dateStr: string): string {
  return DIAS_CORTO[weekdayOf(dateStr)] ?? "";
}

export function diaNombre(dateStr: string): string {
  return DIAS[weekdayOf(dateStr)] ?? "";
}

/** Nombre del día por índice (0=domingo..6=sábado), sin depender de una fecha. */
export function nombreDiaSemana(weekday: number): string {
  return DIAS[weekday] ?? "";
}

export function diaNumero(dateStr: string): number {
  return Number(dateStr.split("-")[2]);
}

/** minutos entre ahora (BA) y el inicio de un turno */
export function minutesUntil(dateStr: string, timeStr: string): number {
  const appt = new Date(`${dateStr}T${normTime(timeStr)}:00-03:00`);
  return Math.round((appt.getTime() - Date.now()) / 60000);
}

/** URL de WhatsApp */
export function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
