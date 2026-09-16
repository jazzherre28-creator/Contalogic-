/** Unifica movimientos manuales y partidas OCR para análisis y flujo de caja */

export type FinanceRecord = {
  category: string;
  amount: number;
  kind: "income" | "expense";
  recorded_at: string;
  source?: "manual" | "ocr";
  note?: string | null;
};

const isIncomeLabel = (k: string) =>
  /ingres|venta|honor|factur|operacional/i.test(k) &&
  !/gasto|costo|egreso|pasiv|activ|deuda/i.test(k);

const isExpenseLabel = (k: string) =>
  (/gasto|costo|cmv|admin|marketing|nomina|sueld|arrend|deprec|amortiz|financ|interes/i.test(k) ||
    /mercanc|materia|producci|servicio/i.test(k)) &&
  !/ingres|venta|activ|patrim/i.test(k);

export function ocrTotalsToRecords(
  totals: Record<string, number>,
  opts: { fileName?: string; docType?: "balance" | "pnl"; scannedAt?: string }
): FinanceRecord[] {
  const at = opts.scannedAt ?? new Date().toISOString();
  const prefix = "[OCR] ";
  const records: FinanceRecord[] = [];

  const push = (label: string, value: number) => {
    const abs = Math.abs(value);
    const cleanLabel = label.startsWith(prefix) ? label : `${prefix}${label}`;

    if (opts.docType === "balance") {
      if (/activ|caja|banco|disponib|efectivo|cartera/i.test(label) && !/pasiv/i.test(label)) {
        records.push({ category: cleanLabel, amount: abs, kind: "income", recorded_at: at, source: "ocr", note: opts.fileName ?? null });
      } else if (/pasiv|deuda|oblig|proveed/i.test(label)) {
        records.push({ category: cleanLabel, amount: abs, kind: "expense", recorded_at: at, source: "ocr", note: opts.fileName ?? null });
      } else {
        records.push({ category: cleanLabel, amount: abs, kind: value < 0 ? "expense" : "income", recorded_at: at, source: "ocr", note: opts.fileName ?? null });
      }
      return;
    }

    if (/debe|débito|debito/i.test(label)) {
      records.push({ category: cleanLabel, amount: abs, kind: "expense", recorded_at: at, source: "ocr", note: opts.fileName ?? null });
    } else if (/haber|crédito|credito/i.test(label)) {
      records.push({ category: cleanLabel, amount: abs, kind: "income", recorded_at: at, source: "ocr", note: opts.fileName ?? null });
    } else if (isIncomeLabel(label)) {
      records.push({ category: cleanLabel, amount: abs, kind: "income", recorded_at: at, source: "ocr", note: opts.fileName ?? null });
    } else if (isExpenseLabel(label)) {
      records.push({ category: cleanLabel, amount: abs, kind: "expense", recorded_at: at, source: "ocr", note: opts.fileName ?? null });
    } else {
      records.push({ category: cleanLabel, amount: abs, kind: value < 0 ? "expense" : "income", recorded_at: at, source: "ocr", note: opts.fileName ?? null });
    }
  };

  for (const [label, value] of Object.entries(totals)) {
    if (!value || value === 0) continue;
    push(label, value);
  }

  return records;
}

export function ocrLineItemsToRecords(
  lineItems: Array<{ label: string; value: number }>,
  opts: { fileName?: string; docType?: "balance" | "pnl"; scannedAt?: string }
): FinanceRecord[] {
  const records: FinanceRecord[] = [];
  const seen = new Set<string>();
  for (const item of lineItems) {
    const key = `${item.label}:${item.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const batch = ocrTotalsToRecords({ [item.label]: item.value }, opts);
    records.push(...batch);
  }
  return records;
}

export function ocrParsedToRecords(
  parsed: { totals?: Record<string, number>; lineItems?: Array<{ label: string; value: number }> },
  opts: { fileName?: string; docType?: "balance" | "pnl"; scannedAt?: string }
): FinanceRecord[] {
  if (parsed.lineItems && parsed.lineItems.length > 0) {
    const fromLines = ocrLineItemsToRecords(parsed.lineItems, opts);
    if (fromLines.length >= (Object.keys(parsed.totals ?? {}).length || 0)) {
      return fromLines;
    }
  }
  return ocrTotalsToRecords(parsed.totals ?? {}, opts);
}

export function mergeFinanceRecords(
  manual: FinanceRecord[],
  ocrBatches: FinanceRecord[],
  mode: "manual" | "ocr" | "combined"
): FinanceRecord[] {
  if (mode === "manual") return manual;
  if (mode === "ocr") return ocrBatches;
  return [...manual, ...ocrBatches];
}

export type CashFlowMetrics = {
  totalIngresos: number;
  totalEgresos: number;
  flujoNeto: number;
  margenFlujo: number;
  promedioIngresoDiario: number;
  promedioEgresoDiario: number;
  quemaMensual: number;
  mesesRunway: number | null;
  diasConMovimiento: number;
  ratioIngresoEgreso: number;
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
  const margenFlujo = totalIngresos > 0 ? (flujoNeto / totalIngresos) * 100 : 0;
  const dayCount = Math.max(1, days.size);
  const promedioIngresoDiario = totalIngresos / dayCount;
  const promedioEgresoDiario = totalEgresos / dayCount;
  const quemaMensual = promedioEgresoDiario * 30;
  const mesesRunway = quemaMensual > 0 && flujoNeto > 0 ? flujoNeto / quemaMensual : null;

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
    ratioIngresoEgreso: totalEgresos > 0 ? totalIngresos / totalEgresos : totalIngresos > 0 ? Infinity : 0,
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
