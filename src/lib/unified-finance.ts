/** Movimientos capturados manualmente y métricas de flujo de caja */

export type FinanceRecord = {
  category: string;
  amount: number;
  kind: "income" | "expense";
  recorded_at: string;
  source: "manual";
  note?: string | null;
};

export type CashFlowMetrics = {
  totalIngresos: number;
  totalEgresos: number;
  flujoNeto: number;
  margenFlujo: number | null;
  promedioIngresoDiario: number;
  promedioEgresoDiario: number;
  quemaMensual: number | null;
  mesesRunway: number | null;
  diasConMovimiento: number;
  ratioIngresoEgreso: number | null;
};

export function computeCashFlowMetrics(records: FinanceRecord[]): CashFlowMetrics {
  let totalIngresos = 0;
  let totalEgresos = 0;
  const days = new Set<string>();

  for (const r of records) {
    const d = r.recorded_at.slice(0, 10);
    days.add(d);
    if (r.kind === "income") totalIngresos += r.amount;
    else totalEgresos += r.amount;
  }

  const flujoNeto = totalIngresos - totalEgresos;
  const margenFlujo = totalIngresos > 0 ? (flujoNeto / totalIngresos) * 100 : null;
  const dayCount = Math.max(1, days.size);
  const promedioIngresoDiario = totalIngresos / dayCount;
  const promedioEgresoDiario = totalEgresos / dayCount;
  const orderedDays = [...days].sort();
  const observedDays = orderedDays.length > 0
    ? Math.floor(
        (Date.parse(`${orderedDays[orderedDays.length - 1]}T00:00:00Z`) -
          Date.parse(`${orderedDays[0]}T00:00:00Z`)) /
          86_400_000,
      ) + 1
    : 0;
  const quemaMensual = observedDays >= 7 ? (totalEgresos / observedDays) * 30 : null;
  const mesesRunway = null;

  return {
    totalIngresos,
    totalEgresos,
    flujoNeto,
    margenFlujo,
    promedioIngresoDiario,
    promedioEgresoDiario,
    quemaMensual,
    mesesRunway,
    diasConMovimiento: days.size,
    ratioIngresoEgreso: totalEgresos > 0 ? totalIngresos / totalEgresos : null,
  };
}

export type CashFlowPoint = {
  period: string;
  ingresos: number;
  egresos: number;
  neto: number;
  acumulado: number;
};

export function buildCashFlowSeries(
  records: FinanceRecord[],
  granularity: "day" | "week" | "month" = "day"
): CashFlowPoint[] {
  const map = new Map<string, { ingresos: number; egresos: number }>();

  const periodKey = (iso: string) => {
    const d = new Date(iso);
    if (granularity === "month") {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    if (granularity === "week") {
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay());
      return start.toISOString().slice(0, 10);
    }
    return iso.slice(0, 10);
  };

  for (const r of records) {
    const key = periodKey(r.recorded_at);
    const cur = map.get(key) ?? { ingresos: 0, egresos: 0 };
    if (r.kind === "income") cur.ingresos += r.amount;
    else cur.egresos += r.amount;
    map.set(key, cur);
  }

  let acumulado = 0;
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, { ingresos, egresos }]) => {
      const neto = ingresos - egresos;
      acumulado += neto;
      return { period, ingresos, egresos, neto, acumulado };
    });
}

export type WaterfallStep = { name: string; value: number; fill: string };

export function buildCashWaterfall(metrics: CashFlowMetrics): WaterfallStep[] {
  return [
    { name: "Ingresos", value: metrics.totalIngresos, fill: "#10b981" },
    { name: "Egresos", value: -metrics.totalEgresos, fill: "#ef4444" },
    { name: "Flujo neto", value: metrics.flujoNeto, fill: metrics.flujoNeto >= 0 ? "#2563eb" : "#ef4444" },
  ];
}
