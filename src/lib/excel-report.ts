import * as XLSX from "xlsx";

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
    ["Concepto", "Base", "Tarifa", "Estimado"],
    ...args.projection.map((p) => [p.concept, p.base, p.rate, p.value]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(projRows);
  XLSX.utils.book_append_sheet(wb, ws2, "Proyección tributaria");

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
