// Reglas de fidelizacion centralizadas. Pasar estos valores a una configuracion
// editable por David es cambiar solo este archivo (o leerlos de business_settings).
export const LOYALTY_MIN_VISITS_PER_MONTH = 3;
export const BENEFIT_DEFAULT_VALID_DAYS = 30;

export type BenefitKind = "percent_20" | "percent_50" | "free_cut";
export type BenefitStatus = "activo" | "usado" | "vencido";

export const BENEFIT_KINDS: BenefitKind[] = ["percent_20", "percent_50", "free_cut"];

export const BENEFIT_LABEL: Record<BenefitKind, { title: string; big: string }> = {
  percent_20: { title: "20% de descuento", big: "20% OFF" },
  percent_50: { title: "50% de descuento", big: "50% OFF" },
  free_cut: { title: "Corte gratis", big: "CORTE GRATIS" },
};

export const BENEFIT_STATUS_LABEL: Record<BenefitStatus, string> = {
  activo: "Activo",
  usado: "Usado",
  vencido: "Vencido",
};

export function isFrequentClient(visitsThisMonth: number): boolean {
  return visitsThisMonth >= LOYALTY_MIN_VISITS_PER_MONTH;
}

/** "vencido" no se guarda: se calcula por fecha (valid_until inclusive). */
export function effectiveBenefitStatus(
  status: "activo" | "usado",
  validUntil: string,
  today: string,
): BenefitStatus {
  if (status === "usado") return "usado";
  return validUntil < today ? "vencido" : "activo";
}

/** Importe sugerido al marcar atendido un turno con beneficio. */
export function suggestedAmount(kind: BenefitKind, price: number | null): number | null {
  if (kind === "free_cut") return 0;
  if (price === null) return null;
  return Math.round(price * (kind === "percent_20" ? 0.8 : 0.5));
}
