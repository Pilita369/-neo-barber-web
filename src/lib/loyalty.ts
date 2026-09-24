import { formatARS } from "./format";

// La regla de fidelizacion (modo, cantidad, beneficio, activo) se configura
// desde business_settings (panel > Configuración); estos son solo los
// valores por defecto que usa esa migracion.
export const BENEFIT_DEFAULT_VALID_DAYS = 30;

export type BenefitKind =
  | "percent_20"
  | "percent_50"
  | "free_cut"
  | "percent_custom"
  | "amount_off"
  | "prepaid_gift";

/** Estado guardado en la base. "vencido" no se guarda: se calcula por fecha. */
export type StoredBenefitStatus = "activo" | "usado" | "cancelado";
export type BenefitStatus = StoredBenefitStatus | "vencido";

/** Los 3 tipos que puede generar automaticamente la regla de fidelizacion. */
export const LOYALTY_BENEFIT_KINDS: Extract<BenefitKind, "percent_20" | "percent_50" | "free_cut">[] =
  ["percent_20", "percent_50", "free_cut"];

export const BENEFIT_LABEL: Record<"percent_20" | "percent_50" | "free_cut", { title: string; big: string }> = {
  percent_20: { title: "20% de descuento", big: "20% OFF" },
  percent_50: { title: "50% de descuento", big: "50% OFF" },
  free_cut: { title: "Corte gratis", big: "CORTE GRATIS" },
};

export const BENEFIT_STATUS_LABEL: Record<BenefitStatus, string> = {
  activo: "Activo",
  usado: "Usado",
  cancelado: "Cancelado",
  vencido: "Vencido",
};

export interface BenefitLike {
  kind: BenefitKind;
  discount_percent?: number | null | undefined;
  discount_amount?: number | null | undefined;
  title?: string | null | undefined;
}

/** Texto corto para listados ("20% de descuento", "Voucher: Corte", etc). */
export function benefitDisplayTitle(b: BenefitLike, serviceName?: string | null): string {
  switch (b.kind) {
    case "percent_20":
    case "percent_50":
    case "free_cut":
      return BENEFIT_LABEL[b.kind].title;
    case "percent_custom":
      return `${b.discount_percent ?? "?"}% de descuento`;
    case "amount_off":
      return `${formatARS(b.discount_amount ?? 0)} de descuento`;
    case "prepaid_gift":
      return serviceName ? `Voucher regalo: ${serviceName}` : "Voucher regalo";
  }
}

/** Texto grande para la tarjeta publica ("20% OFF", "REGALO", etc). */
export function benefitDisplayBig(b: BenefitLike): string {
  switch (b.kind) {
    case "percent_20":
    case "percent_50":
    case "free_cut":
      return BENEFIT_LABEL[b.kind].big;
    case "percent_custom":
      return `${b.discount_percent ?? "?"}% OFF`;
    case "amount_off":
      return `${formatARS(b.discount_amount ?? 0)} OFF`;
    case "prepaid_gift":
      return "REGALO";
  }
}

/** "vencido" no se guarda: se calcula por fecha (valid_until inclusive). */
export function effectiveBenefitStatus(
  status: StoredBenefitStatus,
  validUntil: string,
  today: string,
): BenefitStatus {
  if (status === "usado" || status === "cancelado") return status;
  return validUntil < today ? "vencido" : "activo";
}

/**
 * Importe sugerido al marcar atendido un turno con beneficio. Un voucher
 * prepago sugiere $0 porque el servicio ya fue abonado por otra persona: no
 * es un descuento y no debe registrarse como tal en las estadisticas.
 */
export function suggestedAmount(b: BenefitLike, price: number | null): number | null {
  if (b.kind === "free_cut" || b.kind === "prepaid_gift") return 0;
  if (price === null) return null;
  if (b.kind === "percent_20") return Math.round(price * 0.8);
  if (b.kind === "percent_50") return Math.round(price * 0.5);
  if (b.kind === "percent_custom" && b.discount_percent != null) {
    return Math.round(price * (1 - b.discount_percent / 100));
  }
  if (b.kind === "amount_off" && b.discount_amount != null) {
    return Math.max(0, Math.round(price - b.discount_amount));
  }
  return null;
}

export interface LoyaltySettings {
  loyalty_enabled: boolean;
  loyalty_mode: "monthly" | "cumulative";
  loyalty_visits_required: number;
  loyalty_benefit_kind: "percent_20" | "percent_50" | "free_cut";
}

/** Visitas relevantes segun el modo configurado (mes actual o historico). */
export function loyaltyRelevantVisits(
  settings: LoyaltySettings,
  visitasMes: number,
  visitasHistoricas: number,
): number {
  return settings.loyalty_mode === "cumulative" ? visitasHistoricas : visitasMes;
}

export function isEligibleForBenefit(
  settings: LoyaltySettings,
  visitasMes: number,
  visitasHistoricas: number,
): boolean {
  if (!settings.loyalty_enabled) return false;
  return loyaltyRelevantVisits(settings, visitasMes, visitasHistoricas) >= settings.loyalty_visits_required;
}
