import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  addDays,
  minutesUntil,
  normTime,
  nowTimeBA,
  timeToMin,
  todayBA,
  weekdayOf,
} from "./datetime";
import { toPhoneE164 } from "./phone";
import { computeSlots, type SlotContext } from "./slots";
import type { BusinessHour, Service, Settings } from "./types";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getProfessional(supabase: Awaited<ReturnType<typeof adminClient>>) {
  const { data } = await supabase
    .from("professionals")
    .select("id, name")
    .eq("active", true)
    .limit(1)
    .single();
  return data;
}

async function buildDayContext(
  supabase: Awaited<ReturnType<typeof adminClient>>,
  professionalId: string,
  date: string,
  durationMin: number,
  bufferMin: number,
  minAdvanceHours: number,
): Promise<SlotContext | null> {
  const today = todayBA();
  if (date < today) return null;

  const [{ data: hours }, { data: exceptions }, { data: blocks }, { data: appts }] =
    await Promise.all([
      supabase
        .from("business_hours")
        .select("*")
        .eq("professional_id", professionalId)
        .eq("weekday", weekdayOf(date))
        .maybeSingle(),
      supabase
        .from("availability_exceptions")
        .select("*")
        .eq("professional_id", professionalId)
        .eq("date", date)
        .maybeSingle(),
      supabase
        .from("time_blocks")
        .select("start_time, end_time")
        .eq("professional_id", professionalId)
        .eq("date", date),
      supabase
        .from("appointments")
        .select("start_time, end_time")
        .eq("professional_id", professionalId)
        .eq("date", date)
        .in("status", ["pendiente", "confirmado", "atendido"]),
    ]);

  let earliestTime: string | null = null;
  if (date === today) {
    const min = timeToMin(nowTimeBA()) + minAdvanceHours * 60;
    earliestTime = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  }

  return {
    hours: (hours as BusinessHour | null) ?? null,
    exception: exceptions ?? null,
    blocks: (blocks ?? []).map((b: { start_time: string; end_time: string }) => ({
      start: b.start_time,
      end: b.end_time,
    })),
    appointments: (appts ?? []).map((a: { start_time: string; end_time: string }) => ({
      start: a.start_time,
      end: a.end_time,
    })),
    durationMin,
    bufferMin,
    earliestTime,
  };
}

export const getBookingData = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = await adminClient();
  const professional = await getProfessional(supabase);
  if (!professional) throw new Error("No hay profesional disponible");
  const [{ data: settings }, { data: services }] = await Promise.all([
    supabase.from("business_settings").select("*").eq("id", 1).single(),
    supabase.from("services").select("*").eq("active", true).order("sort_order"),
  ]);
  return {
    settings: settings as Settings,
    professional,
    services: (services ?? []) as Service[],
  };
});

export const getAvailability = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({ serviceId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const supabase = await adminClient();
    const professional = await getProfessional(supabase);
    const { data: service } = await supabase
      .from("services")
      .select("*")
      .eq("id", data.serviceId)
      .eq("active", true)
      .single();
    const { data: settings } = await supabase
      .from("business_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (!professional || !service || !settings) return { slots: [] as string[] };
    if (data.date > addDays(todayBA(), settings.max_days_ahead)) return { slots: [] as string[] };

    const ctx = await buildDayContext(
      supabase,
      professional.id,
      data.date,
      service.duration_min,
      service.buffer_min,
      settings.min_advance_hours,
    );
    if (!ctx) return { slots: [] as string[] };
    return { slots: computeSlots(ctx) };
  });

export const getAvailableDays = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ serviceId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = await adminClient();
    const professional = await getProfessional(supabase);
    const { data: service } = await supabase
      .from("services")
      .select("*")
      .eq("id", data.serviceId)
      .eq("active", true)
      .single();
    const { data: settings } = await supabase
      .from("business_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (!professional || !service || !settings) return { days: [] as string[] };

    const today = todayBA();
    const last = addDays(today, settings.max_days_ahead);

    const [{ data: hours }, { data: exceptions }, { data: blocks }, { data: appts }] =
      await Promise.all([
        supabase.from("business_hours").select("*").eq("professional_id", professional.id),
        supabase
          .from("availability_exceptions")
          .select("*")
          .eq("professional_id", professional.id)
          .gte("date", today)
          .lte("date", last),
        supabase
          .from("time_blocks")
          .select("*")
          .eq("professional_id", professional.id)
          .gte("date", today)
          .lte("date", last),
        supabase
          .from("appointments")
          .select("date, start_time, end_time")
          .eq("professional_id", professional.id)
          .gte("date", today)
          .lte("date", last)
          .in("status", ["pendiente", "confirmado", "atendido"]),
      ]);

    const hoursByDay = new Map<number, BusinessHour>(
      (hours ?? []).map((h: BusinessHour) => [h.weekday, h]),
    );
    const exByDate = new Map((exceptions ?? []).map((e: { date: string }) => [e.date, e]));
    const blocksByDate = new Map<string, { start_time: string; end_time: string }[]>();
    for (const b of blocks ?? []) {
      const list = blocksByDate.get(b.date) ?? [];
      list.push(b);
      blocksByDate.set(b.date, list);
    }
    const apptsByDate = new Map<string, { start_time: string; end_time: string }[]>();
    for (const a of appts ?? []) {
      const list = apptsByDate.get(a.date) ?? [];
      list.push(a);
      apptsByDate.set(a.date, list);
    }

    const days: string[] = [];
    for (let i = 0; i <= settings.max_days_ahead; i++) {
      const date = addDays(today, i);
      const exception = exByDate.get(date) ?? null;
      const dayHours = (hoursByDay.get(weekdayOf(date)) as BusinessHour | undefined) ?? null;
      let earliestTime: string | null = null;
      if (date === today) {
        const min = timeToMin(nowTimeBA()) + settings.min_advance_hours * 60;
        earliestTime = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
      }
      const slots = computeSlots({
        hours: dayHours,
        exception: (exception as unknown as SlotContext["exception"]) ?? null,
        blocks: (blocksByDate.get(date) ?? []).map((b) => ({
          start: b.start_time,
          end: b.end_time,
        })),
        appointments: (apptsByDate.get(date) ?? []).map((a) => ({
          start: a.start_time,
          end: a.end_time,
        })),
        durationMin: service.duration_min,
        bufferMin: service.buffer_min,
        earliestTime,
      });
      if (slots.length > 0) days.push(date);
    }
    return { days };
  });

const phoneRegex = /^[0-9+\s()-]{6,20}$/;

export const createAppointment = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        serviceId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/),
        name: z.string().trim().min(2, "Ingresá tu nombre").max(60),
        lastname: z.string().trim().min(2, "Ingresá tu apellido").max(60),
        phone: z.string().trim().regex(phoneRegex, "Ingresá un número de WhatsApp válido"),
        notes: z.string().trim().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const supabase = await adminClient();
    const professional = await getProfessional(supabase);
    const { data: service } = await supabase
      .from("services")
      .select("*")
      .eq("id", data.serviceId)
      .eq("active", true)
      .single();
    const { data: settings } = await supabase
      .from("business_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (!professional || !service || !settings) throw new Error("No se pudo procesar la reserva");

    const phone = data.phone.replace(/\D/g, "");
    const phoneE164 = toPhoneE164(data.phone);
    const ctx = await buildDayContext(
      supabase,
      professional.id,
      data.date,
      service.duration_min,
      service.buffer_min,
      settings.min_advance_hours,
    );
    const slots = ctx ? computeSlots(ctx) : [];
    if (!slots.includes(data.time)) {
      throw new Error("Ese horario ya no está disponible. Elegí otro, por favor.");
    }

    const endMin = timeToMin(data.time) + service.duration_min + service.buffer_min;
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

    const { data: appt, error } = await supabase.rpc("create_appointment", {
      p_professional_id: professional.id,
      p_service_id: service.id,
      p_client_name: data.name,
      p_client_lastname: data.lastname,
      p_client_phone: phone,
      p_notes: data.notes ?? "",
      p_date: data.date,
      p_start_time: data.time,
      p_end_time: endTime,
      p_phone_e164: phoneE164,
    });
    if (error) {
      if (String(error.message).includes("SLOT_TAKEN")) {
        throw new Error("Ese horario acaba de reservarse. Elegí otro, por favor.");
      }
      throw new Error("No se pudo crear el turno. Intentá de nuevo.");
    }
    const a = Array.isArray(appt) ? appt[0] : appt;
    return {
      token: a.token as string,
      code: a.code as string,
      needsApproval: Boolean(a.needs_approval),
    };
  });

export const getAppointmentByToken = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ token: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = await adminClient();
    const { data: appt } = await supabase
      .from("appointments")
      .select(
        "id, code, client_name, client_lastname, client_phone, notes, date, start_time, end_time, status, needs_approval, service_id, price_at_booking, services(name, duration_min, show_price), professionals(name)",
      )
      .eq("token", data.token)
      .maybeSingle();
    if (!appt) return { appointment: null };
    const { data: settings } = await supabase
      .from("business_settings")
      .select("*")
      .eq("id", 1)
      .single();
    const svc = appt.services as unknown as {
      name: string;
      duration_min: number;
      show_price: boolean;
    } | null;
    const prof = appt.professionals as unknown as { name: string } | null;
    const canModify =
      (appt.status === "pendiente" || appt.status === "confirmado") &&
      minutesUntil(appt.date, appt.start_time) >= (settings?.cancel_hours_limit ?? 0) * 60;
    return {
      appointment: {
        id: appt.id,
        code: appt.code,
        client_name: appt.client_name,
        client_lastname: appt.client_lastname,
        client_phone: appt.client_phone,
        notes: appt.notes,
        date: appt.date,
        start_time: normTime(appt.start_time),
        end_time: normTime(appt.end_time),
        status: appt.status,
        needs_approval: appt.needs_approval,
        service_name: svc?.name ?? "",
        service_duration: svc?.duration_min ?? 0,
        service_price: svc?.show_price && appt.price_at_booking !== null ? appt.price_at_booking : null,
        professional_name: prof?.name ?? "",
      },
      settings: settings as Settings,
      canModify,
    };
  });

export const cancelAppointmentByToken = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = await adminClient();
    const { data: appt } = await supabase
      .from("appointments")
      .select("id, date, start_time, status")
      .eq("token", data.token)
      .maybeSingle();
    if (!appt) throw new Error("No encontramos ese turno");
    if (appt.status !== "pendiente" && appt.status !== "confirmado") {
      throw new Error("Este turno ya no se puede cancelar");
    }
    const { data: settings } = await supabase
      .from("business_settings")
      .select("cancel_hours_limit")
      .eq("id", 1)
      .single();
    if (minutesUntil(appt.date, appt.start_time) < (settings?.cancel_hours_limit ?? 0) * 60) {
      throw new Error(
        "Ya no se puede cancelar online por la proximidad del turno. Avisanos por WhatsApp.",
      );
    }
    await supabase
      .from("appointments")
      .update({ status: "cancelado", updated_at: new Date().toISOString() })
      .eq("id", appt.id);
    return { ok: true };
  });
