import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { todayBA } from "./datetime";
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

export const createBenefit = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        clientId: z.string().uuid(),
        kind: z.enum(["percent_20", "percent_50", "free_cut"]),
        validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(data),
  )
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      data,
      context,
    }: { data: { clientId: string; kind: BenefitKind; validUntil: string } } & Ctx) => {
      await assertAdmin(context);
      if (data.validUntil < todayBA()) throw new Error("La fecha de vencimiento ya pasó");
      const supabase = await adminClient();
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("id", data.clientId)
        .maybeSingle();
      if (!client) throw new Error("Cliente no encontrado");
      const { data: benefit, error } = await supabase
        .from("benefits")
        .insert({ client_id: data.clientId, kind: data.kind, valid_until: data.validUntil })
        .select("id, token")
        .single();
      if (error || !benefit) throw new Error("No se pudo crear el beneficio");
      return { id: benefit.id, token: benefit.token };
    },
  );

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
      .select("kind, status, valid_until, clients(name)")
      .eq("token", data.token)
      .maybeSingle();
    if (!benefit) return { benefit: null };
    const client = benefit.clients as unknown as { name: string } | null;
    return {
      benefit: {
        first_name: (client?.name ?? "").trim().split(/\s+/)[0] ?? "",
        kind: benefit.kind as BenefitKind,
        valid_until: benefit.valid_until as string,
        status: effectiveBenefitStatus(
          benefit.status as "activo" | "usado",
          benefit.valid_until as string,
          todayBA(),
        ),
      },
    };
  });
