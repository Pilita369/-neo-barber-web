/** 25000 -> "$25.000" */
export function formatARS(value: number): string {
  return `$${Math.round(value).toLocaleString("es-AR")}`;
}
