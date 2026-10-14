import * as XLSX from "xlsx";
import { computeCashFlowMetrics, type FinanceRecord } from "@/lib/unified-finance";

export function exportScannerAnalysisXLSX(args: {
  fileName: string;
  docType: string;
  totals: Record<string, number>;
  analysisMarkdown: string;
  projection: Array<{ concept: string; base: string; rate: string; value: string }>;
}) {
  const wb = XLSX.utils.book_new();

  const totalsRows = [
    ["Concepto", "Valor (COP)"],
    ...Object.entries(args.totals).map(([k, v]) => [k, v]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(totalsRows);
  XLSX.utils.book_append_sheet(wb, ws1, "Valores detectados");

  const projRows = [
    ["Concepto", "Base / soporte requerido", "Tarifa", "Valor / estado"],
    ...args.projection.map((p) => [p.concept, p.base, p.rate, p.value]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(projRows);
  XLSX.utils.book_append_sheet(wb, ws2, "Datos tributarios");

  const ws3 = XLSX.utils.aoa_to_sheet(
    args.analysisMarkdown.split(/\r?\n/).map((l) => [l])
  );
  XLSX.utils.book_append_sheet(wb, ws3, "Análisis LEX AI");

  XLSX.writeFile(wb, `analisis-${args.docType}-${Date.now()}.xlsx`);
}

export function exportCalculatorXLSX(args: {
  records: Array<{ category: string; amount: number; kind: string; note: string | null; recorded_at: string }>;
}) {
  const wb = XLSX.utils.book_new();
  const manualRecords: FinanceRecord[] = args.records.map((r) => ({
    ...r,
    kind: r.kind === "income" ? "income" : "expense",
    source: "manual",
  }));
  const metrics = computeCashFlowMetrics(manualRecords);
  const sortedDates = args.records.map((r) => r.recorded_at).sort();
  const summaryRows = [
    ["Análisis de movimientos manuales", "Valor"],
    ["Origen de datos", "Calculadora manual; documentos OCR excluidos"],
    ["Movimientos", args.records.length],
    ["Ingresos (COP)", metrics.totalIngresos],
    ["Egresos (COP)", metrics.totalEgresos],
    ["Flujo neto registrado (COP)", metrics.flujoNeto],
    ["Margen del flujo (%)", metrics.margenFlujo ?? "N/D (sin ingresos)"],
    ["Egreso mensual aproximado (COP)", metrics.quemaMensual ?? "N/D (requiere al menos 7 días observados)"],
    ["Runway", "N/D: requiere saldo de caja inicial y obligaciones proyectadas"],
    ["Días con movimientos", metrics.diasConMovimiento],
    ["Primer movimiento", sortedDates.length ? new Date(sortedDates[0]).toLocaleDateString("es-CO") : "N/D"],
    ["Último movimiento", sortedDates.length ? new Date(sortedDates[sortedDates.length - 1]).toLocaleDateString("es-CO") : "N/D"],
    ["Alcance", "El flujo neto registrado no representa necesariamente el saldo de caja o utilidad contable."],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summarySheet, "Análisis manual");

  const byCategory = new Map<string, { income: number; expense: number }>();
  args.records.forEach((r) => {
    const current = byCategory.get(r.category) ?? { income: 0, expense: 0 };
    if (r.kind === "income") current.income += Number(r.amount);
    else current.expense += Number(r.amount);
    byCategory.set(r.category, current);
  });
  const categoryRows = [
    ["Categoría", "Ingresos (COP)", "Egresos (COP)", "Neto (COP)"],
    ...[...byCategory.entries()]
      .sort((a, b) => b[1].income + b[1].expense - a[1].income - a[1].expense)
      .map(([category, value]) => [category, value.income, value.expense, value.income - value.expense]),
  ];
  const categorySheet = XLSX.utils.aoa_to_sheet(categoryRows);
  XLSX.utils.book_append_sheet(wb, categorySheet, "Resumen por categoría");

  const rows = [
    ["Fecha", "Categoría", "Tipo", "Monto", "Nota"],
    ...args.records.map((r) => [
      new Date(r.recorded_at).toLocaleString("es-CO"),
      r.category,
      r.kind === "income" ? "Ingreso" : "Egreso",
      Number(r.amount),
      r.note ?? "",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
  XLSX.writeFile(wb, `movimientos-${Date.now()}.xlsx`);
}
