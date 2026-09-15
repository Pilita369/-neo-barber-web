import { minToTime, normTime, timeToMin } from "./datetime";

export interface DayHours {
  enabled: boolean;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  slot_interval_min: number;
}

export interface Interval {
  start: string; // "HH:mm"
  end: string;
}

export interface SlotContext {
  hours: DayHours | null;
  exception: { is_available: boolean; start_time: string | null; end_time: string | null } | null;
  blocks: Interval[];
  appointments: Interval[]; // turnos activos (pendiente/confirmado)
  durationMin: number;
  bufferMin: number;
  /** horarios anteriores a este "HH:mm" no se ofrecen (solo aplica si es hoy) */
  earliestTime: string | null;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && aEnd > bStart;
}

/** Devuelve los horarios de inicio disponibles ("HH:mm") para un servicio en un día */
export function computeSlots(ctx: SlotContext): string[] {
  let start: string;
  let end: string;
  let interval = 30;
  let breakStart: string | null = null;
  let breakEnd: string | null = null;

  if (ctx.exception) {
    if (!ctx.exception.is_available || !ctx.exception.start_time || !ctx.exception.end_time) {
      return [];
    }
    start = ctx.exception.start_time;
    end = ctx.exception.end_time;
    if (ctx.hours) interval = ctx.hours.slot_interval_min;
  } else {
    if (!ctx.hours || !ctx.hours.enabled) return [];
    start = ctx.hours.start_time;
    end = ctx.hours.end_time;
    breakStart = ctx.hours.break_start;
    breakEnd = ctx.hours.break_end;
    interval = ctx.hours.slot_interval_min;
  }

  const total = ctx.durationMin + ctx.bufferMin;
  const openMin = timeToMin(normTime(start));
  const closeMin = timeToMin(normTime(end));
  const earliest = ctx.earliestTime ? timeToMin(ctx.earliestTime) : null;

  const busy = [
    ...ctx.blocks.map((b) => [timeToMin(normTime(b.start)), timeToMin(normTime(b.end))]),
    ...ctx.appointments.map((a) => [timeToMin(normTime(a.start)), timeToMin(normTime(a.end))]),
  ] as [number, number][];

  const slots: string[] = [];
  for (let t = openMin; t + ctx.durationMin <= closeMin; t += interval) {
    const s = t;
    const e = t + total; // incluye buffer para no pegar turnos
    const eService = t + ctx.durationMin;
    if (earliest !== null && s < earliest) continue;
    if (breakStart && breakEnd && overlaps(s, eService, timeToMin(breakStart), timeToMin(breakEnd))) continue;
    if (busy.some(([bs, be]) => overlaps(s, e, bs, be))) continue;
    slots.push(minToTime(s));
  }
  return slots;
}
