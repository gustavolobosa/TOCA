export const plans = {
  mensual: { name: "Plan mensual", net: 2200, vat: 418, total: 2618, months: 1, period: "mes" },
  anual: { name: "Plan anual", net: 22000, vat: 4180, total: 26180, months: 12, period: "año" },
} as const;
export type PlanId = keyof typeof plans;
export function isPlan(value: unknown): value is PlanId { return value === "mensual" || value === "anual"; }
export function pesos(value: number) { return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value); }
