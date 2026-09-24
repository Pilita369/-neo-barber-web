import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { monthRange, todayBA } from "./datetime";
import type { ClientListItem, ClientMonthAppointment, ClientProfile } from "./types";

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

export const listClients = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ search: z.string().trim().max(60).optional() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { search?: string | undefined } } & Ctx) => {
    await assertAdmin(context);

    let query = context.supabase.from("clients").select("*");
    if (data.search) {
      const digits = data.search.replace(/\D/g, "");
      const orParts = [`name.ilike.%${data.search}%`, `lastname.ilike.%${data.search}%`];
      if (digits.length >= 3) orParts.push(`phone_e164.ilike.%${digits}%`);
      query = query.or(orParts.join(","));
    }
    const { data: clients, error } = await query.order("name");
    if (error) throw new Error("No se pudo cargar la lista de clientes");
    const clientIds = (clients ?? []).map((c: { id: string }) => c.id);

    const { data: completados } = clientIds.length
      ? await context.supabase
          .from("appointments")
          .select("client_id, date")
          .in("client_id", clientIds)
          .eq("status", "atendido")
      : { data: [] };

    const statsByClient = new Map<string, { total: number; lastVisit: string | null }>();
    for (const row of completados ?? []) {
      const current = statsByClient.get(row.client_id) ?? { total: 0, lastVisit: null };
      current.total += 1;
      if (!current.lastVisit || row.date > current.lastVisit) current.lastVisit = row.date;
      statsByClient.set(row.client_id, current);
    }

    const today = todayBA();
    const { data: activeBenefits } = clientIds.length
      ? await context.supabase
          .from("benefits")
          .select("client_id")
          .in("client_id", clientIds)
          .eq("status", "activo")
          .gte("valid_until", today)
      : { data: [] };
    const withBenefit = new Set((activeBenefits ?? []).map((b: { client_id: string }) => b.client_id));

    const result: ClientListItem[] = (clients ?? []).map((c: any) => ({
      ...c,
      total_completados: statsByClient.get(c.id)?.total ?? 0,
      last_visit: statsByClient.get(c.id)?.lastVisit ?? null,
      has_benefit: withBenefit.has(c.id),
    }));
    return result;
  });

export const getClientProfile = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ clientId: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { clientId: string } } & Ctx) => {
    await assertAdmin(context);

    const { data: client, error: clientError } = await context.supabase
      .from("clients")
      .select("*")
      .eq("id", data.clientId)
      .single();
    if (clientError || !client) throw new Error("Cliente no encontrado");

    const today = todayBA();
    const monthPrefix = today.slice(0, 7);
    const [{ data: next }, { data: completados }, { data: benefits }] = await Promise.all([
      context.supabase
        .from("appointments")
        .select("id, date, start_time, services(name)")
        .eq("client_id", data.clientId)
        .in("status", ["pendiente", "confirmado"])
        .gte("date", today)
        .order("date")
        .order("start_time")
        .limit(1),
      context.supabase
        .from("appointments")
        .select("date, charged_amount")
        .eq("client_id", data.clientId)
        .eq("status", "atendido")
        .order("date", { ascending: false }),
      context.supabase
        .from("benefits")
        .select(
          "id, token, kind, status, valid_until, created_at, sent_at, used_at, title, message, service_id, discount_percent, discount_amount, services(name)",
        )
        .eq("client_id", data.clientId)
        .order("created_at", { ascending: false }),
    ]);

    let visitasMes = 0;
    let gastadoMes = 0;
    let gastadoHistorico = 0;
    let sinImporteMes = 0;
    let sinImporteHistorico = 0;
    for (const row of completados ?? []) {
      const esDelMes = String(row.date).startsWith(monthPrefix);
      if (esDelMes) visitasMes += 1;
      if (row.charged_amount === null) {
        sinImporteHistorico += 1;
        if (esDelMes) sinImporteMes += 1;
      } else {
        gastadoHistorico += Number(row.charged_amount);
        if (esDelMes) gastadoMes += Number(row.charged_amount);
      }
    }

    const nextRow = (next ?? [])[0] as any;
    const profile: ClientProfile = {
      client,
      next_appointment: nextRow
        ? {
            id: nextRow.id,
            date: nextRow.date,
            start_time: String(nextRow.start_time).slice(0, 5),
            service_name: nextRow.services?.name ?? "",
          }
        : null,
      last_visit: completados && completados.length > 0 ? completados[0].date : null,
      total_completados: completados?.length ?? 0,
      visitas_mes: visitasMes,
      gastado_mes: gastadoMes,
      gastado_historico: gastadoHistorico,
      sin_importe_mes: sinImporteMes,
      sin_importe_historico: sinImporteHistorico,
      benefits: (benefits ?? []).map((b: any) => ({ ...b, service_name: b.services?.name ?? null })) as ClientProfile["benefits"],
    };
    return profile;
  });

export const getClientMonth = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        clientId: z.string().uuid(),
        year: z.number().int().min(2020).max(2100),
        month: z.number().int().min(1).max(12),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { clientId: string; year: number; month: number } } & Ctx) => {
    await assertAdmin(context);
    const { from, to } = monthRange(data.year, data.month);
    const { data: appts, error } = await context.supabase
      .from("appointments")
      .select("id, date, start_time, services(name)")
      .eq("client_id", data.clientId)
      .eq("status", "atendido")
      .gte("date", from)
      .lte("date", to)
      .order("date")
      .order("start_time");
    if (error) throw new Error("No se pudo cargar el calendario del cliente");

    const result: ClientMonthAppointment[] = (appts ?? []).map((a: any) => ({
      id: a.id,
      date: a.date,
      start_time: String(a.start_time).slice(0, 5),
      service_name: a.services?.name ?? "",
    }));
    return result;
  });
