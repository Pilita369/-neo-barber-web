import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { monthRange, timeToMin, todayBA } from "./datetime";
import { toPhoneE164 } from "./phone";

type Ctx = { context: { supabase: any; userId: string } };

async function assertAdmin(ctx: Ctx["context"]) {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("No tenés permisos de administrador");
}

async function getProfessionalId(supabase: any): Promise<string> {
  const { data } = await supabase.from("professionals").select("id").limit(1).single();
  return data.id;
}

export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }: Ctx) => {
    const { data, error } = await context.supabase.rpc("claim_admin");
    if (error) throw new Error("No se pudo activar el acceso de administrador");
    return { isAdmin: Boolean(data) };
  });

export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }: Ctx) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: Boolean(data) };
  });

export const getPanelData = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { from: string; to: string } } & Ctx) => {
    await assertAdmin(context);
    const professionalId = await getProfessionalId(context.supabase);
    const [
      { data: appts },
      { data: blocks },
      { data: exceptions },
      { data: hours },
      { data: services },
      { data: settings },
    ] = await Promise.all([
      context.supabase
        .from("appointments")
        .select(
          "id, code, client_name, client_lastname, client_phone, notes, date, start_time, end_time, status, needs_approval, service_id, services(name, duration_min)",
        )
        .eq("professional_id", professionalId)
        .gte("date", data.from)
        .lte("date", data.to)
        .order("date")
        .order("start_time"),
      context.supabase
        .from("time_blocks")
        .select("*")
        .eq("professional_id", professionalId)
        .gte("date", data.from)
        .lte("date", data.to)
        .order("date"),
      context.supabase
        .from("availability_exceptions")
        .select("*")
        .eq("professional_id", professionalId)
        .gte("date", data.from)
        .lte("date", data.to)
        .order("date"),
      context.supabase
        .from("business_hours")
        .select("*")
        .eq("professional_id", professionalId)
        .order("weekday"),
      context.supabase.from("services").select("*").order("sort_order"),
      context.supabase.from("business_settings").select("*").eq("id", 1).single(),
    ]);

    const appointments = (appts ?? []).map((a: any) => ({
      ...a,
      start_time: String(a.start_time).slice(0, 5),
      end_time: String(a.end_time).slice(0, 5),
      service_name: a.services?.name ?? "",
    }));
    const today = todayBA();
    const todays = appointments.filter((a: any) => a.date === today);
    return {
      appointments,
      blocks: blocks ?? [],
      exceptions: exceptions ?? [],
      hours: hours ?? [],
      services: services ?? [],
      settings,
      stats: {
        hoy: todays.filter((a: any) => a.status !== "cancelado").length,
        pendientes: todays.filter((a: any) => a.status === "pendiente").length,
        confirmados: todays.filter((a: any) => a.status === "confirmado").length,
        cancelados: appointments.filter((a: any) => a.status === "cancelado").length,
        noAsistieron: appointments.filter((a: any) => a.status === "no_asistio").length,
      },
    };
  });

export const getAgendaMonth = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        year: z.number().int().min(2020).max(2100),
        month: z.number().int().min(1).max(12),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { year: number; month: number } } & Ctx) => {
    await assertAdmin(context);
    const professionalId = await getProfessionalId(context.supabase);
    const { from, to } = monthRange(data.year, data.month);
    const { data: appts } = await context.supabase
      .from("appointments")
      .select(
        "id, code, client_name, client_lastname, client_phone, notes, date, start_time, end_time, status, needs_approval, service_id, price_at_booking, charged_amount, benefit_id, benefits(kind), services(name, duration_min)",
      )
      .eq("professional_id", professionalId)
      .gte("date", from)
      .lte("date", to)
      .order("date")
      .order("start_time");

    const appointments = (appts ?? []).map((a: any) => ({
      ...a,
      start_time: String(a.start_time).slice(0, 5),
      end_time: String(a.end_time).slice(0, 5),
      service_name: a.services?.name ?? "",
      benefit_kind: a.benefits?.kind ?? null,
    }));
    return { appointments };
  });

export const marcarAtendido = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        chargedAmount: z.number().min(0),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { id: string; chargedAmount: number } } & Ctx) => {
    await assertAdmin(context);
    const { data: updated } = await context.supabase
      .from("appointments")
      .update({
        status: "atendido",
        charged_amount: data.chargedAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("benefit_id")
      .single();
    if (updated?.benefit_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("benefits")
        .update({ status: "usado", used_at: new Date().toISOString() })
        .eq("id", updated.benefit_id);
    }
    return { ok: true };
  });

export const getBusinessSummary = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        year: z.number().int().min(2020).max(2100),
        month: z.number().int().min(1).max(12),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { year: number; month: number } } & Ctx) => {
    await assertAdmin(context);
    const professionalId = await getProfessionalId(context.supabase);
    const { from, to } = monthRange(data.year, data.month);
    const { data: rows } = await context.supabase
      .from("appointments")
      .select("client_id, client_phone, charged_amount, service_id, services(name)")
      .eq("professional_id", professionalId)
      .eq("status", "atendido")
      .gte("date", from)
      .lte("date", to);
    const list = rows ?? [];
    const clientKeys = new Set(list.map((r: any) => r.client_id ?? `phone:${r.client_phone}`));
    const conImporte = list.filter((r: any) => r.charged_amount !== null);
    const ventas = conImporte.reduce((sum: number, r: any) => sum + Number(r.charged_amount), 0);

    const porServicioMap = new Map<string, { name: string; cantidad: number; facturacion: number }>();
    for (const r of list as any[]) {
      const key = r.service_id ?? "sin-servicio";
      const name = r.services?.name ?? "Sin servicio";
      const entry = porServicioMap.get(key) ?? { name, cantidad: 0, facturacion: 0 };
      entry.cantidad += 1;
      if (r.charged_amount !== null) entry.facturacion += Number(r.charged_amount);
      porServicioMap.set(key, entry);
    }
    const porServicio = [...porServicioMap.values()].sort((a, b) => b.cantidad - a.cantidad);

    return {
      clientesAtendidos: clientKeys.size,
      serviciosRealizados: list.length,
      ventas,
      turnosSinImporte: list.length - conImporte.length,
      porServicio,
    };
  });

export const setAppointmentStatus = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pendiente", "confirmado", "atendido", "cancelado", "no_asistio"]),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { id: string; status: string } } & Ctx) => {
    await assertAdmin(context);
    if (data.status === "pendiente" || data.status === "confirmado") {
      const { data: cur } = await context.supabase
        .from("appointments")
        .select("professional_id, date, start_time, end_time")
        .eq("id", data.id)
        .single();
      const { data: clash } = await context.supabase
        .from("appointments")
        .select("id")
        .eq("professional_id", cur.professional_id)
        .eq("date", cur.date)
        .neq("id", data.id)
        .in("status", ["pendiente", "confirmado", "atendido"])
        .lt("start_time", cur.end_time)
        .gt("end_time", cur.start_time)
        .limit(1);
      if (clash && clash.length > 0) {
        throw new Error("Ese horario ya está ocupado por otro turno activo");
      }
    }
    const libera = data.status === "cancelado" || data.status === "no_asistio";
    await context.supabase
      .from("appointments")
      .update({
        status: data.status,
        ...(libera ? { benefit_id: null } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    return { ok: true };
  });

export const deleteAppointment = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { id: string } } & Ctx) => {
    await assertAdmin(context);
    const { data: appt } = await context.supabase
      .from("appointments")
      .select("status")
      .eq("id", data.id)
      .single();
    if (!appt) throw new Error("Turno no encontrado");
    if (appt.status === "atendido") {
      throw new Error("Un turno atendido no se puede eliminar: alimenta ventas y estadísticas");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("appointments").delete().eq("id", data.id);
    return { ok: true };
  });

export const approveAppointment = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { id: string } } & Ctx) => {
    await assertAdmin(context);
    await context.supabase
      .from("appointments")
      .update({ needs_approval: false, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });

export const rejectAppointment = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { id: string } } & Ctx) => {
    await assertAdmin(context);
    await context.supabase
      .from("appointments")
      .update({ status: "cancelado", needs_approval: false, benefit_id: null, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    return { ok: true };
  });

export const createManualAppointment = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        serviceId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/),
        name: z.string().trim().min(2).max(60),
        lastname: z.string().trim().min(1).max(60).default("-"),
        phone: z.string().trim().min(6).max(20),
        notes: z.string().trim().max(300).optional(),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: any } & Ctx) => {
    await assertAdmin(context);
    const professionalId = await getProfessionalId(context.supabase);
    const { data: service } = await context.supabase
      .from("services")
      .select("duration_min, buffer_min")
      .eq("id", data.serviceId)
      .single();
    const endMin = timeToMin(data.time) + service.duration_min + service.buffer_min;
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
    const phoneE164 = toPhoneE164(data.phone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: appt, error } = await supabaseAdmin.rpc("create_appointment", {
      p_professional_id: professionalId,
      p_service_id: data.serviceId,
      p_client_name: data.name,
      p_client_lastname: data.lastname,
      p_client_phone: data.phone.replace(/\D/g, ""),
      p_notes: data.notes ?? null,
      p_date: data.date,
      p_start_time: data.time,
      p_end_time: endTime,
      p_admin_created: true,
      p_phone_e164: phoneE164,
    });
    if (error) {
      if (String(error.message).includes("SLOT_TAKEN"))
        throw new Error("Ese horario ya está ocupado");
      throw new Error("No se pudo crear el turno");
    }
    const a = Array.isArray(appt) ? appt[0] : appt;
    return { id: a.id, token: a.token };
  });

const blockSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().max(120).optional(),
});

export const addBlock = createServerFn({ method: "POST" })
  .inputValidator((data) => blockSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: z.infer<typeof blockSchema> } & Ctx) => {
    await assertAdmin(context);
    if (timeToMin(data.end) <= timeToMin(data.start))
      throw new Error("El horario de fin debe ser posterior al de inicio");
    const professionalId = await getProfessionalId(context.supabase);
    await context.supabase.from("time_blocks").insert({
      professional_id: professionalId,
      date: data.date,
      start_time: data.start,
      end_time: data.end,
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

export const deleteBlock = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { id: string } } & Ctx) => {
    await assertAdmin(context);
    await context.supabase.from("time_blocks").delete().eq("id", data.id);
    return { ok: true };
  });

const exceptionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isAvailable: z.boolean(),
  start: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  end: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  reason: z.string().trim().max(120).optional(),
});

export const addException = createServerFn({ method: "POST" })
  .inputValidator((data) => exceptionSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: z.infer<typeof exceptionSchema> } & Ctx) => {
    await assertAdmin(context);
    const professionalId = await getProfessionalId(context.supabase);
    await context.supabase.from("availability_exceptions").upsert(
      {
        professional_id: professionalId,
        date: data.date,
        is_available: data.isAvailable,
        start_time: data.isAvailable ? (data.start ?? null) : null,
        end_time: data.isAvailable ? (data.end ?? null) : null,
        reason: data.reason ?? null,
      },
      { onConflict: "professional_id,date" },
    );
    return { ok: true };
  });

export const deleteException = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { id: string } } & Ctx) => {
    await assertAdmin(context);
    await context.supabase.from("availability_exceptions").delete().eq("id", data.id);
    return { ok: true };
  });

export const listServices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }: Ctx) => {
    await assertAdmin(context);
    const { data } = await context.supabase.from("services").select("*").order("sort_order");
    return data ?? [];
  });

const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  duration_min: z.number().int().min(5).max(480),
  buffer_min: z.number().int().min(0).max(120),
  price: z.number().min(0).nullable(),
  show_price: z.boolean(),
  active: z.boolean(),
});

export const upsertService = createServerFn({ method: "POST" })
  .inputValidator((data) => serviceSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: z.infer<typeof serviceSchema> } & Ctx) => {
    await assertAdmin(context);
    const row = {
      name: data.name,
      description: data.description ?? null,
      duration_min: data.duration_min,
      buffer_min: data.buffer_min,
      price: data.price,
      show_price: data.show_price,
      active: data.active,
    };
    if (data.id) {
      await context.supabase.from("services").update(row).eq("id", data.id);
    } else {
      const { data: max } = await context.supabase
        .from("services")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1);
      await context.supabase
        .from("services")
        .insert({ ...row, sort_order: (max?.[0]?.sort_order ?? 0) + 1 });
    }
    return { ok: true };
  });

export const deleteService = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { id: string } } & Ctx) => {
    await assertAdmin(context);
    const { data: used } = await context.supabase
      .from("appointments")
      .select("id")
      .eq("service_id", data.id)
      .limit(1);
    if (used && used.length > 0) {
      await context.supabase.from("services").update({ active: false }).eq("id", data.id);
      return { deactivated: true };
    }
    await context.supabase.from("services").delete().eq("id", data.id);
    return { deactivated: false };
  });

const hoursRowSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  enabled: z.boolean(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  break_start: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  break_end: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  slot_interval_min: z.number().int().min(10).max(120),
});

export const saveHours = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ rows: z.array(hoursRowSchema) }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ data, context }: { data: { rows: z.infer<typeof hoursRowSchema>[] } } & Ctx) => {
      await assertAdmin(context);
      const professionalId = await getProfessionalId(context.supabase);
      for (const row of data.rows) {
        await context.supabase
          .from("business_hours")
          .upsert(
            { professional_id: professionalId, ...row },
            { onConflict: "professional_id,weekday" },
          );
      }
      return { ok: true };
    },
  );

const settingsSchema = z.object({
  business_name: z.string().trim().min(2).max(80),
  address: z.string().trim().min(2).max(160),
  whatsapp: z.string().trim().min(8).max(20),
  welcome_text: z.string().trim().min(2).max(160),
  share_text: z.string().trim().max(300),
  instagram_url: z
    .string()
    .trim()
    .url()
    .nullable()
    .or(z.literal("").transform(() => null)),
  min_advance_hours: z.number().int().min(0).max(72),
  max_days_ahead: z.number().int().min(1).max(90),
  cancel_hours_limit: z.number().int().min(0).max(72),
});

export const saveSettings = createServerFn({ method: "POST" })
  .inputValidator((data) => settingsSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: z.infer<typeof settingsSchema> } & Ctx) => {
    await assertAdmin(context);
    await context.supabase.from("business_settings").update(data).eq("id", 1);
    return { ok: true };
  });
