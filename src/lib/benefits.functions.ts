import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { todayBA } from "./datetime";
import { toPhoneE164 } from "./phone";
import { effectiveBenefitStatus, type BenefitKind } from "./loyalty";

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

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const createBenefitSchema = z
  .object({
    clientId: z.string().uuid().optional(),
    newClient: z
      .object({
        name: z.string().trim().min(2).max(60),
        lastname: z.string().trim().max(60).optional(),
        phone: z.string().trim().min(6).max(20),
      })
      .optional(),
    kind: z.enum(["percent_20", "percent_50", "free_cut", "percent_custom", "amount_off", "prepaid_gift"]),
    discountPercent: z.number().min(1).max(99).optional(),
    discountAmount: z.number().min(1).optional(),
    serviceId: z.string().uuid().optional(),
    title: z.string().trim().max(60).optional(),
    message: z.string().trim().max(200).optional(),
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((d) => d.clientId ?? d.newClient, { message: "Falta el destinatario" })
  .refine((d) => d.kind !== "percent_custom" || d.discountPercent != null, {
    message: "Falta el porcentaje",
  })
  .refine((d) => d.kind !== "amount_off" || d.discountAmount != null, {
    message: "Falta el monto",
  })
  .refine((d) => d.kind !== "prepaid_gift" || d.serviceId != null, {
    message: "Un voucher regalo necesita un servicio",
  });

export const createBenefit = createServerFn({ method: "POST" })
  .inputValidator((data) => createBenefitSchema.parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: z.infer<typeof createBenefitSchema> } & Ctx) => {
    await assertAdmin(context);
    if (data.validUntil < todayBA()) throw new Error("La fecha de vencimiento ya pasó");
    const supabase = await adminClient();

    let clientId = data.clientId ?? null;
    if (!clientId && data.newClient) {
      const phoneE164 = toPhoneE164(data.newClient.phone);
      if (!phoneE164) throw new Error("El WhatsApp del destinatario no es válido");
      const { data: client, error } = await supabase
        .from("clients")
        .upsert(
          { phone_e164: phoneE164, name: data.newClient.name, lastname: data.newClient.lastname ?? null },
          { onConflict: "phone_e164", ignoreDuplicates: false },
        )
        .select("id")
        .single();
      if (error || !client) throw new Error("No se pudo registrar el destinatario");
      clientId = client.id;
    }
    if (!clientId) throw new Error("Cliente no encontrado");

    const { data: benefit, error } = await supabase
      .from("benefits")
      .insert({
        client_id: clientId,
        kind: data.kind,
        valid_until: data.validUntil,
        title: data.title ?? null,
        message: data.message ?? null,
        service_id: data.serviceId ?? null,
        discount_percent: data.kind === "percent_custom" ? (data.discountPercent ?? null) : null,
        discount_amount: data.kind === "amount_off" ? (data.discountAmount ?? null) : null,
      })
      .select("id, token")
      .single();
    if (error || !benefit) throw new Error("No se pudo crear el beneficio");
    return { id: benefit.id, token: benefit.token };
  });

export const markBenefitSent = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ benefitId: z.string().uuid() }).parse(data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }: { data: { benefitId: string } } & Ctx) => {
    await assertAdmin(context);
    const supabase = await adminClient();
    await supabase
      .from("benefits")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", data.benefitId);
    return { ok: true };
  });

/** Publico: devuelve solo lo minimo para mostrar la tarjeta. Nunca IDs ni telefono. */
export const getBenefitPublic = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ token: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const supabase = await adminClient();
    const { data: benefit } = await supabase
      .from("benefits")
      .select(
        "kind, status, valid_until, title, message, discount_percent, discount_amount, clients(name), services(name)",
      )
      .eq("token", data.token)
      .maybeSingle();
    if (!benefit) return { benefit: null };
    const client = benefit.clients as unknown as { name: string } | null;
    const service = benefit.services as unknown as { name: string } | null;
    return {
      benefit: {
        first_name: (client?.name ?? "").trim().split(/\s+/)[0] ?? "",
        kind: benefit.kind as BenefitKind,
        valid_until: benefit.valid_until as string,
        title: benefit.title as string | null,
        message: benefit.message as string | null,
        discount_percent: benefit.discount_percent as number | null,
        discount_amount: benefit.discount_amount as number | null,
        service_name: service?.name ?? null,
        status: effectiveBenefitStatus(
          benefit.status as "activo" | "usado",
          benefit.valid_until as string,
          todayBA(),
        ),
      },
    };
  });
