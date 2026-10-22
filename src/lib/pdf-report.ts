import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SECTOR_LABEL, ENTITY_LABEL } from "@/lib/sectors";
import type { DatosFinancierosGlobales } from "@/lib/global-finance-state";
import {
  classifyTotals,
  computeBalanceIndicators,
  computePnLIndicators,
  dataQualityScore,
  type IndicatorRow,
} from "@/lib/financial-analytics";
import { computeTaxSavings } from "@/lib/tax-savings";
import { computeCashFlowMetrics } from "@/lib/unified-finance";
import { computeTransportTripMetrics, type TransportTrip } from "@/lib/transport-analytics";

export type ReportProfile = {
  display_name?: string | null;
  email?: string | null;
  nit?: string | null;
  sector?: string | null;
  entity_type?: string | null;
};

/* ─── Diseño ─── */
const BRAND: [number, number, number] = [23, 37, 84];
const ACCENT: [number, number, number] = [37, 99, 235];
const TEXT: [number, number, number] = [22, 28, 45];
const MUTED: [number, number, number] = [100, 108, 125];
const OK: [number, number, number] = [16, 130, 90];
const WARN: [number, number, number] = [200, 130, 20];
const BAD: [number, number, number] = [190, 45, 45];
const LIGHT: [number, number, number] = [245, 247, 252];

const M = 18;
const W = 174;
const FOOTER = 285;

const TABLE_BASE = {
  headStyles: {
    fillColor: BRAND,
    textColor: [255, 255, 255] as [number, number, number],
    fontStyle: "bold" as const,
    fontSize: 9,
    cellPadding: 3,
  },
  styles: {
    fontSize: 9,
    cellPadding: 3,
    textColor: TEXT,
    lineColor: [220, 224, 232] as [number, number, number],
    lineWidth: 0.15,
    overflow: "linebreak" as const,
  },
  alternateRowStyles: { fillColor: [252, 253, 255] as [number, number, number] },
  margin: { left: M, right: M },
};

/* ─── Formato ─── */
function fmtCOP(n: number | null) {
  if (n == null) return "N/D";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtCompact(n: number) {
  if (!Number.isFinite(n) || n === 0) return fmtCOP(0);
  if (Math.abs(n) >= 1_000_000)
    return new Intl.NumberFormat("es-CO", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  return fmtCOP(n);
}

function fmtOptionalCompact(n: number | null) {
  return n == null ? "N/D" : fmtCompact(n);
}

function fmtPct(n: number | null, d = 1) {
  return n == null ? "N/D" : `${n.toFixed(d)}%`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function wrap(doc: jsPDF, text: string, max: number) {
  return doc.splitTextToSize(text, max) as string[];
}

function nextPage(doc: jsPDF, y: number, need: number) {
  if (y + need > FOOTER - 6) {
    doc.addPage();
    return 22;
  }
  return y;
}

function tableEnd(doc: jsPDF) {
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
}

function downloadPdf(doc: jsPDF, fileName: string) {
  const blob = doc.output("blob");
  if (blob.size === 0) throw new Error("El PDF se generó vacío y no se puede descargar.");

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function drawFinancialBars(
  doc: jsPDF,
  y: number,
  rows: Array<{ label: string; value: number; color: [number, number, number] }>,
) {
  const visibleRows = rows.filter(({ value }) => Number.isFinite(value));
  const max = Math.max(0, ...visibleRows.map(({ value }) => Math.abs(value)));
  if (visibleRows.length === 0 || max === 0) {
    return paragraph(doc, y, "No hay cifras clasificadas suficientes para representar un gráfico.");
  }

  const rowHeight = 10;
  y = nextPage(doc, y, visibleRows.length * rowHeight + 5);
  visibleRows.forEach(({ label, value, color }, index) => {
    const rowY = y + index * rowHeight;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT);
    doc.text(wrap(doc, label, 48).slice(0, 1), M, rowY + 3);
    doc.setFillColor(...LIGHT);
    doc.rect(M + 52, rowY, 77, 4, "F");
    doc.setFillColor(...color);
    doc.rect(M + 52, rowY, Math.max(0.5, (Math.abs(value) / max) * 77), 4, "F");
    doc.setTextColor(...MUTED);
    doc.text(`${value < 0 ? "−" : ""}${fmtCompact(Math.abs(value))}`, 210 - M, rowY + 3, {
      align: "right",
    });
  });
  return y + visibleRows.length * rowHeight + 2;
}

function drawTable(doc: jsPDF, opts: Parameters<typeof autoTable>[1]) {
  autoTable(doc, {
    ...opts,
    headStyles: { ...TABLE_BASE.headStyles, ...(opts?.headStyles ?? {}) },
    styles: { ...TABLE_BASE.styles, ...(opts?.styles ?? {}) },
    alternateRowStyles: TABLE_BASE.alternateRowStyles,
    margin: TABLE_BASE.margin,
  });
}

/* ─── Datos tributarios reportados y requisitos de información ─── */
type TaxRow = { concept: string; base: string; rate: string; amount: string };

function buildTaxProjection(impuestoRentaReportado?: number): { rows: TaxRow[]; note: string } {
  const rows: TaxRow[] = [
    { concept: "IVA generado", base: "Requiere ventas gravadas", rate: "N/D", amount: "N/D" },
    {
      concept: "IVA descontable",
      base: "Requiere detalle de facturas",
      rate: "N/D",
      amount: "N/D",
    },
    {
      concept: "Impuesto de renta reportado",
      base: "Según estado financiero",
      rate: impuestoRentaReportado == null ? "N/D" : "Reportado",
      amount: impuestoRentaReportado == null ? "N/D" : fmtCOP(impuestoRentaReportado),
    },
    {
      concept: "ICA",
      base: "Requiere municipio, actividad y base gravable",
      rate: "N/D",
      amount: "N/D",
    },
    {
      concept: "Total de tributos",
      base: "No determinable con la información disponible",
      rate: "—",
      amount: "N/D",
    },
  ];

  return {
    rows,
    note: "No se proyectan IVA ni ICA a partir de un estado financiero resumido. La renta reportada se presenta como dato del documento, no como liquidación: valide periodo, régimen, conciliación fiscal, retenciones y soportes con un contador.",
  };
}

function buildFiscalSavingsRows(
  totals: Record<string, number> | null,
  profile: ReportProfile,
  docType: "balance" | "pnl",
  datos?: DatosFinancierosGlobales,
) {
  const merged: Record<string, number> = totals ?? {};
  if (datos) {
    if (datos.ingresos) merged["Ingresos operacionales"] = datos.ingresos;
    if (datos.costos) merged["Costo de ventas"] = datos.costos;
    if (datos.gastos) merged["Gastos operacionales"] = datos.gastos;
    if (datos.activos) merged["Total activos"] = datos.activos;
    if (datos.activosNoCorrientes) merged["Activos fijos"] = datos.activosNoCorrientes;
  }
  return computeTaxSavings(merged, profile, docType)
    .filter((t) => t.potentialSaving > 0 || t.id === "general")
    .slice(0, 6);
}

function indicatorStatusLabel(s: IndicatorRow["status"]) {
  if (s === "good") return "OK";
  if (s === "warn") return "Alerta";
  if (s === "bad") return "Critico";
  return "N/D";
}

function indicatorStatusColor(s: IndicatorRow["status"]): [number, number, number] {
  if (s === "good") return OK;
  if (s === "warn") return WARN;
  if (s === "bad") return BAD;
  return MUTED;
}

/* ─── Componentes de layout ─── */
function header(
  doc: jsPDF,
  title: string,
  subtitle: string,
  profile?: ReportProfile,
  tag?: string,
) {
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, 210, 34, "F");
  doc.setFillColor(180, 140, 20);
  doc.rect(0, 34, 210, 1, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("CONTALOGIC AI+", M, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Informe financiero y tributario", M, 18);

  const now = new Date().toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
  doc.text(now, 210 - M, 11, { align: "right" });
  if (tag) doc.text(tag, 210 - M, 17, { align: "right" });

  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, M, 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  wrap(doc, subtitle, W).forEach((l, i) => doc.text(l, M, 54 + i * 4.5));

  let metaY = 66;
  const meta = [
    profile?.display_name,
    profile?.entity_type ? (ENTITY_LABEL as Record<string, string>)[profile.entity_type] : null,
    profile?.sector ? (SECTOR_LABEL as Record<string, string>)[profile.sector] : null,
    profile?.nit ? `NIT ${profile.nit}` : null,
  ].filter(Boolean) as string[];

  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  meta.forEach((line) => {
    doc.text(line, M, metaY);
    metaY += 4.5;
  });

  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.4);
  doc.line(M, metaY + 2, 210 - M, metaY + 2);
  return metaY + 10;
}

function footer(doc: jsPDF) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 224, 232);
    doc.line(M, FOOTER - 5, 210 - M, FOOTER - 5);
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(
      "Confidencial · Contalogic AI+ · Estatuto Tributario Colombiano (referencia)",
      M,
      FOOTER,
    );
    doc.text(`${i} / ${n}`, 210 - M, FOOTER, { align: "right" });
  }
}

function section(doc: jsPDF, y: number, num: string, title: string) {
  y = nextPage(doc, y, 12);
  doc.setFillColor(...ACCENT);
  doc.rect(M, y - 3, 2.5, 9, "F");
  doc.setFillColor(...LIGHT);
  doc.rect(M + 4, y - 3, W - 4, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND);
  doc.text(`${num}. ${title}`, M + 7, y + 3);
  return y + 11;
}

function kpiGrid(
  doc: jsPDF,
  y: number,
  items: Array<{ label: string; value: string; hint?: string }>,
) {
  y = nextPage(doc, y, 42);
  const cols = 2;
  const gap = 5;
  const cw = (W - gap) / cols;
  const ch = 22;

  items.forEach((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = M + col * (cw + gap);
    const yy = y + row * (ch + gap);

    doc.setDrawColor(220, 224, 232);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, yy, cw, ch, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    wrap(doc, item.label.toUpperCase(), cw - 8).forEach((l, li) =>
      doc.text(l, x + 4, yy + 6 + li * 3.2),
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...TEXT);
    doc.text(item.value, x + 4, yy + 15);

    if (item.hint) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(item.hint, x + 4, yy + 20);
    }
  });

  const rows = Math.ceil(items.length / cols);
  return y + rows * (ch + gap) + 4;
}

function diagnosis(doc: jsPDF, y: number, text: string, level: "ok" | "warn" | "bad") {
  y = nextPage(doc, y, 14);
  const c = level === "ok" ? OK : level === "warn" ? WARN : BAD;
  doc.setFillColor(c[0], c[1], c[2], 0.1);
  doc.setDrawColor(c[0], c[1], c[2], 0.35);
  doc.roundedRect(M, y, W, 11, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(c[0], c[1], c[2]);
  wrap(doc, text, W - 10).forEach((l, i) => doc.text(l, M + 5, y + 7 + i * 4));
  return y + 11 + (wrap(doc, text, W - 10).length > 1 ? 4 : 0);
}

function paragraph(doc: jsPDF, y: number, text: string) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  wrap(doc, text, W).forEach((l) => {
    y = nextPage(doc, y, 5);
    doc.text(l, M, y);
    y += 4.5;
  });
  return y + 3;
}

function bullets(doc: jsPDF, y: number, items: string[]) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT);
  for (const item of items) {
    wrap(doc, `- ${item}`, W - 4).forEach((l, i) => {
      y = nextPage(doc, y, 5);
      doc.text(l, M + (i > 0 ? 3 : 0), y);
      y += 4.5;
    });
    y += 2;
  }
  return y;
}

function indicatorsTable(doc: jsPDF, y: number, indicators: IndicatorRow[]) {
  const groups = [...new Set(indicators.map((i) => i.group))];
  for (const group of groups) {
    y = nextPage(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(group.toUpperCase(), M, y);
    y += 4;

    const rows = indicators
      .filter((i) => i.group === group)
      .map((i) => [i.name, i.display, i.benchmark ?? "—", indicatorStatusLabel(i.status)]);

    drawTable(doc, {
      startY: y,
      head: [["Indicador", "Valor", "Referencia", "Estado"]],
      body: rows,
      columnStyles: {
        0: { cellWidth: 52 },
        1: { halign: "right", fontStyle: "bold", cellWidth: 32 },
        2: { halign: "center", cellWidth: 28 },
        3: { halign: "center", cellWidth: 22 },
      },
    });
    y = tableEnd(doc);
  }
  return y;
}

function taxTable(doc: jsPDF, y: number, projection: ReturnType<typeof buildTaxProjection>) {
  drawTable(doc, {
    startY: y,
    head: [["Impuesto", "Base / soporte requerido", "Tarifa", "Valor / estado"]],
    body: projection.rows.map((r) => [r.concept, r.base, r.rate, r.amount]),
    columnStyles: {
      0: { cellWidth: 58 },
      1: { halign: "right", cellWidth: 38 },
      2: { halign: "center", cellWidth: 22 },
      3: { halign: "right", fontStyle: "bold", cellWidth: 38 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === projection.rows.length - 1) {
        data.cell.styles.fillColor = [235, 241, 255];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  return tableEnd(doc);
}

function savingsTable(doc: jsPDF, y: number, tips: ReturnType<typeof computeTaxSavings>) {
  if (tips.length === 0) return y;
  drawTable(doc, {
    startY: y,
    head: [["Oportunidad", "Norma", "Ahorro estimado", "Accion recomendada"]],
    body: tips.map((t) => [
      t.title,
      t.article,
      t.potentialSaving > 0 ? fmtCOP(t.potentialSaving) : "—",
      t.action,
    ]),
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 22, fontSize: 8 },
      2: { halign: "right", fontStyle: "bold", cellWidth: 28 },
      3: { cellWidth: 72, fontSize: 8 },
    },
  });
  return tableEnd(doc);
}

function renderMarkdown(doc: jsPDF, y: number, md: string) {
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      y += 2;
      continue;
    }
    y = nextPage(doc, y, 6);
    if (/^#{1,3}\s/.test(line)) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...ACCENT);
      wrap(doc, line.replace(/^#{1,3}\s/, ""), W).forEach((l) => {
        y = nextPage(doc, y, 5);
        doc.text(l, M, y);
        y += 5;
      });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
    } else if (/^[-*]\s/.test(line)) {
      wrap(doc, `- ${line.replace(/^[-*]\s/, "").replace(/\*\*/g, "")}`, W - 3).forEach((l, i) => {
        y = nextPage(doc, y, 5);
        doc.text(l, M + (i > 0 ? 3 : 0), y);
        y += 4.5;
      });
    } else {
      wrap(doc, line.replace(/\*\*/g, ""), W).forEach((l) => {
        y = nextPage(doc, y, 5);
        doc.text(l, M, y);
        y += 4.5;
      });
    }
  }
  return y;
}

/* ══════════════════════════════════════
   REPORTES PUBLICOS
   ══════════════════════════════════════ */

export function generateDashboardReport(args: {
  profile: ReportProfile;
  totals: { income: number; expense: number; balance: number };
  records: Array<{ category: string; amount: number; kind: string; recorded_at: string }>;
}) {
  const { profile, totals, records } = args;
  const doc = new jsPDF();
  let y = header(
    doc,
    "Informe financiero consolidado",
    "Resumen de movimientos, indicadores y datos tributarios disponibles.",
    profile,
    "FINANZAS",
  );

  const margen = totals.income > 0 ? (totals.balance / totals.income) * 100 : null;
  const tax = buildTaxProjection();

  y = section(doc, y, "1", "Resumen del periodo");
  y = kpiGrid(doc, y, [
    { label: "Ingresos", value: fmtCompact(totals.income), hint: fmtCOP(totals.income) },
    { label: "Egresos", value: fmtCompact(totals.expense), hint: fmtCOP(totals.expense) },
    {
      label: "Resultado neto",
      value: fmtCompact(totals.balance),
      hint: margen != null ? `Margen ${fmtPct(margen)}` : undefined,
    },
    { label: "Movimientos", value: String(records.length) },
  ]);

  y = diagnosis(
    doc,
    y,
    totals.balance >= 0
      ? "Flujo positivo. Los movimientos no contienen la información fiscal necesaria para liquidar impuestos."
      : `Deficit de ${fmtCOP(Math.abs(totals.balance))}. Revise egresos antes de proyectar tributos.`,
    totals.balance >= 0 ? "ok" : "bad",
  );

  y = section(doc, y, "2", "Informacion tributaria disponible");
  y = taxTable(doc, y, tax);
  y = paragraph(doc, y, tax.note);

  y = section(doc, y, "3", "Oportunidades de ahorro fiscal");
  y = savingsTable(
    doc,
    y,
    buildFiscalSavingsRows({ Ingresos: totals.income, Gastos: totals.expense }, profile, "pnl"),
  );

  footer(doc);
  doc.save(`informe-financiero-${Date.now()}.pdf`);
}

export function generateCalculatorReport(args: {
  profile: ReportProfile;
  records: Array<{
    category: string;
    amount: number;
    kind: string;
    note: string | null;
    recorded_at: string;
  }>;
}) {
  const { profile, records } = args;
  const sorted = [...records].sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
  );

  let income = 0;
  let expense = 0;
  records.forEach((r) => {
    if (r.kind === "income") income += Number(r.amount);
    else expense += Number(r.amount);
  });
  const balance = income - expense;
  const margen = income > 0 ? (balance / income) * 100 : null;
  const cashMetrics = computeCashFlowMetrics(
    records.map((record) => ({
      ...record,
      kind: record.kind === "income" ? ("income" as const) : ("expense" as const),
      source: "manual" as const,
    })),
  );

  const byCat = new Map<string, { in: number; out: number }>();
  records.forEach((r) => {
    const c = byCat.get(r.category) ?? { in: 0, out: 0 };
    if (r.kind === "income") c.in += Number(r.amount);
    else c.out += Number(r.amount);
    byCat.set(r.category, c);
  });

  const doc = new jsPDF();
  let y = header(
    doc,
    "Libro auxiliar de movimientos manuales",
    "Análisis de caja de registros de la calculadora; no incluye estados OCR.",
    profile,
    "CALCULADORA",
  );

  const tax = buildTaxProjection();

  y = section(doc, y, "1", "Resumen");
  y = kpiGrid(doc, y, [
    { label: "Ingresos", value: fmtCompact(income) },
    { label: "Egresos", value: fmtCompact(expense) },
    {
      label: "Saldo neto",
      value: fmtCompact(balance),
      hint: margen != null ? fmtPct(margen) : undefined,
    },
    { label: "Registros", value: String(records.length) },
    { label: "Egreso mensual aprox.", value: fmtOptionalCompact(cashMetrics.quemaMensual) },
    { label: "Runway", value: "N/D", hint: "requiere saldo de caja disponible" },
  ]);
  y = paragraph(
    doc,
    y,
    `Margen de flujo: ${fmtPct(cashMetrics.margenFlujo)}. Días con movimientos: ${cashMetrics.diasConMovimiento}. El egreso mensual solo se extrapola cuando hay al menos 7 días entre el primer y último movimiento. El saldo neto registrado no equivale a caja disponible; por eso no se calcula runway.`,
  );

  y = section(doc, y, "2", "Consolidado por categoria");
  drawTable(doc, {
    startY: y,
    head: [["Categoria", "Ingresos", "Egresos", "Neto"]],
    body: [...byCat.entries()]
      .sort((a, b) => b[1].in + b[1].out - (a[1].in + a[1].out))
      .map(([cat, v]) => [cat, fmtCOP(v.in), fmtCOP(v.out), fmtCOP(v.in - v.out)]),
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right", fontStyle: "bold" },
    },
  });
  y = tableEnd(doc);

  y = section(doc, y, "3", "Detalle cronologico");
  drawTable(doc, {
    startY: y,
    head: [["Fecha", "Categoria", "Tipo", "Monto", "Nota"]],
    body: sorted.map((r) => [
      fmtDate(r.recorded_at),
      r.category,
      r.kind === "income" ? "Ingreso" : "Egreso",
      fmtCOP(Number(r.amount)),
      r.note ?? "",
    ]),
    columnStyles: {
      0: { cellWidth: 24 },
      3: { halign: "right", fontStyle: "bold" },
      4: { cellWidth: 36, fontSize: 8 },
    },
  });
  y = tableEnd(doc);

  y = section(doc, y, "4", "Informacion tributaria disponible");
  y = taxTable(doc, y, tax);
  y = paragraph(doc, y, tax.note);

  y = section(doc, y, "5", "Ahorro fiscal recomendado");
  y = savingsTable(
    doc,
    y,
    buildFiscalSavingsRows({ Ingresos: income, Gastos: expense }, profile, "pnl"),
  );

  footer(doc);
  doc.save(`movimientos-${Date.now()}.pdf`);
}

export function generateScannerReport(args: {
  profile: ReportProfile;
  fileName: string;
  docType: string;
  totals: Record<string, number>;
  lineItems?: Array<{ label: string; value: number; period?: string }>;
  comparativeLineItems?: Array<{ label: string; value: number; period?: string }>;
  meta?: {
    unitLabel?: string;
    unitMultiplier?: number;
    periodLabel?: string;
    comparativePeriodLabel?: string;
  };
  analysisMarkdown: string;
}) {
  const {
    profile,
    fileName,
    docType,
    totals,
    lineItems = [],
    comparativeLineItems = [],
    meta,
    analysisMarkdown,
  } = args;
  const type = docType === "balance" ? "balance" : "pnl";
  const c = classifyTotals(totals);
  const quality = dataQualityScore(Object.keys(totals).filter((k) => totals[k] !== 0).length);
  const margenBruto =
    c.hasGrossProfit && c.ingresos > 0 ? (c.utilidadBruta / c.ingresos) * 100 : null;
  const margenNeto = c.hasNetIncome && c.ingresos > 0 ? (c.utilidadNeta / c.ingresos) * 100 : null;

  const doc = new jsPDF();
  const docLabel =
    type === "balance" ? "Estado de situacion financiera" : "Estado de resultados (P&L)";

  let y = header(doc, "Analisis OCR", `${docLabel} · ${fileName}`, profile, "ESCANER");

  /* --- KPIs segun tipo de documento --- */
  y = section(doc, y, "1", "Cifras principales");
  if (meta?.unitLabel) {
    y = diagnosis(
      doc,
      y,
      `Fuente en ${meta.unitLabel}. El resumen financiero se normalizó a COP con factor × ${meta.unitMultiplier ?? 1}; la tabla de partidas conserva los valores impresos.`,
      "ok",
    );
  }
  if (type === "balance") {
    const hasCapitalTrabajo = c.hasCurrentAssets && c.hasCurrentLiabilities;
    const capitalTrabajo = hasCapitalTrabajo ? c.activosCorrientes - c.pasivosCorrientes : null;
    const canVerifyEquation = c.hasTotalAssets && c.hasTotalLiabilities && c.hasEquity;
    y = kpiGrid(doc, y, [
      { label: "Total activos", value: fmtOptionalCompact(c.hasTotalAssets ? c.activos : null) },
      {
        label: "Total pasivos",
        value: fmtOptionalCompact(c.hasTotalLiabilities ? c.pasivos : null),
      },
      { label: "Patrimonio", value: fmtOptionalCompact(c.hasEquity ? c.patrimonio : null) },
      {
        label: "Capital de trabajo",
        value: fmtOptionalCompact(capitalTrabajo),
        hint: "Activos corrientes - Pasivos corrientes",
      },
    ]);
    if (canVerifyEquation) {
      const dif = Math.abs(c.activos - (c.pasivos + c.patrimonio));
      const cuadra = dif <= Math.max(1, c.activos * 0.05);
      y = diagnosis(
        doc,
        y,
        cuadra
          ? "La ecuacion contable (Activos = Pasivos + Patrimonio) cuadra dentro de tolerancia."
          : `Descuadre detectado: ${fmtCOP(dif)}. Valide totales antes de usar el informe.`,
        cuadra ? "ok" : "warn",
      );
    } else {
      y = diagnosis(
        doc,
        y,
        "No se puede verificar A = P + Patrimonio: faltan uno o mas totales en el documento.",
        "warn",
      );
    }
  } else {
    const utilidad = c.hasNetIncome ? c.utilidadNeta : null;
    const mn = utilidad != null && c.ingresos > 0 ? (utilidad / c.ingresos) * 100 : null;
    y = kpiGrid(doc, y, [
      {
        label: "Ingresos",
        value: fmtOptionalCompact(c.ingresosEntries.length > 0 ? c.ingresos : null),
      },
      { label: "Costos", value: fmtOptionalCompact(c.costEntries.length > 0 ? c.costos : null) },
      { label: "Gastos", value: fmtOptionalCompact(c.expenseEntries.length > 0 ? c.gastos : null) },
      {
        label: "Utilidad neta",
        value: fmtOptionalCompact(utilidad),
        hint: mn != null ? `Margen ${fmtPct(mn)}` : undefined,
      },
    ]);
    y = diagnosis(
      doc,
      y,
      utilidad == null
        ? margenBruto != null
          ? `Margen bruto ${fmtPct(margenBruto)}. Utilidad neta no reportada o no calculable con los datos disponibles.`
          : "Datos insuficientes para calcular margenes y utilidad neta."
        : `Margen bruto ${fmtPct(margenBruto)} · Utilidad neta reportada ${fmtCOP(utilidad)}.`,
      utilidad == null ? "warn" : utilidad >= 0 ? "ok" : "bad",
    );
  }

  if (type === "pnl" && c.hasOperatingProfit && c.hasGrossProfit && c.expenseEntries.length > 0) {
    const formulaEbit = c.utilidadBruta - c.gastos + c.otrosIngresosOperativos;
    const difference = c.utilidadOperativa - formulaEbit;
    if (Math.abs(difference) > Math.max(1_000, Math.abs(c.utilidadOperativa) * 0.001)) {
      y = diagnosis(
        doc,
        y,
        `Inconsistencia: EBIT reportado ${fmtCOP(c.utilidadOperativa)}; utilidad bruta - gastos operativos + otros ingresos operativos = ${fmtCOP(formulaEbit)} (diferencia ${fmtCOP(difference)}).`,
        "warn",
      );
    }
  }
  if (type === "pnl" && c.hasProfitBeforeTax && c.hasIncomeTax && c.hasNetIncome) {
    const formulaNet = c.utilidadAntesImpuestos - c.impuestoRenta;
    const difference = c.utilidadNeta - formulaNet;
    if (Math.abs(difference) > Math.max(1_000, Math.abs(c.utilidadNeta) * 0.001)) {
      y = diagnosis(
        doc,
        y,
        `Inconsistencia: utilidad neta reportada ${fmtCOP(c.utilidadNeta)}; utilidad antes de impuestos - impuesto de renta = ${fmtCOP(formulaNet)} (diferencia ${fmtCOP(difference)}).`,
        "warn",
      );
    }
  }

  y = paragraph(doc, y, quality.insight);

  y = section(doc, y, "2", "Gráfico de cifras principales (COP normalizados)");
  const chartRows =
    type === "balance"
      ? [
          { label: "Activos", value: c.hasTotalAssets ? c.activos : 0, color: OK },
          { label: "Pasivos", value: c.hasTotalLiabilities ? c.pasivos : 0, color: BAD },
          { label: "Patrimonio", value: c.hasEquity ? c.patrimonio : 0, color: ACCENT },
        ]
      : [
          { label: "Ingresos", value: c.ingresos, color: OK },
          { label: "Costos", value: c.costos, color: WARN },
          { label: "Gastos operacionales", value: c.gastos, color: BAD },
          { label: "Utilidad neta", value: c.hasNetIncome ? c.utilidadNeta : 0, color: ACCENT },
        ];
  y = drawFinancialBars(doc, y, chartRows);

  y = section(doc, y, "3", "Partidas completas extraídas del documento");
  const sourceRows = [
    ...lineItems.map((item) => [
      item.period ?? meta?.periodLabel ?? "Principal",
      item.label,
      `$ ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(item.value)}`,
    ]),
    ...comparativeLineItems.map((item) => [
      item.period ?? meta?.comparativePeriodLabel ?? "Comparativo",
      item.label,
      `$ ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(item.value)}`,
    ]),
  ];
  const sourceValueHeader =
    `${sourceRows.length > 0 ? "Valor original" : "Valor COP"}` +
    `${meta?.unitLabel ? ` (${meta.unitLabel})` : ""}`;
  drawTable(doc, {
    startY: y,
    head: [["Periodo", "Concepto", sourceValueHeader]],
    body:
      sourceRows.length > 0
        ? sourceRows
        : Object.entries(totals).map(([label, value]) => [
            "COP normalizados",
            label,
            fmtCOP(value),
          ]),
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 88 },
      2: { halign: "right", cellWidth: 48 },
    },
  });
  y = tableEnd(doc);

  /* --- Tabla estructurada: no mezclar partidas crudas con totales --- */
  y = section(doc, y, "4", type === "balance" ? "Estructura patrimonial" : "Estado de resultados");

  if (type === "balance") {
    drawTable(doc, {
      startY: y,
      head: [["Rubro", "Valor (COP)"]],
      body: [
        ["Activos corrientes", fmtCOP(c.hasCurrentAssets ? c.activosCorrientes : null)],
        ["Activos no corrientes", fmtCOP(c.hasNonCurrentAssets ? c.activosNoCorrientes : null)],
        ["Total activos", fmtCOP(c.hasTotalAssets ? c.activos : null)],
        ["Pasivos corrientes", fmtCOP(c.hasCurrentLiabilities ? c.pasivosCorrientes : null)],
        [
          "Pasivos no corrientes",
          fmtCOP(c.hasNonCurrentLiabilities ? c.pasivosNoCorrientes : null),
        ],
        ["Total pasivos", fmtCOP(c.hasTotalLiabilities ? c.pasivos : null)],
        ["Patrimonio", fmtCOP(c.hasEquity ? c.patrimonio : null)],
        [
          "Pasivos + Patrimonio",
          fmtCOP(c.hasTotalLiabilities && c.hasEquity ? c.pasivos + c.patrimonio : null),
        ],
      ],
      columnStyles: { 0: { cellWidth: 90 }, 1: { halign: "right", fontStyle: "bold" } },
    });
  } else {
    drawTable(doc, {
      startY: y,
      head: [["Concepto", "Valor (COP)", "% s/ ingresos"]],
      body: [
        [
          "Ingresos operacionales",
          fmtCOP(c.ingresosEntries.length > 0 ? c.ingresos : null),
          c.ingresosEntries.length > 0 ? "100%" : "N/D",
        ],
        [
          "Costo de ventas",
          fmtCOP(c.costEntries.length > 0 ? c.costos : null),
          fmtPct(c.ingresos > 0 && c.costEntries.length > 0 ? (c.costos / c.ingresos) * 100 : null),
        ],
        ["Utilidad bruta", fmtCOP(c.hasGrossProfit ? c.utilidadBruta : null), fmtPct(margenBruto)],
        [
          "Gastos operacionales",
          fmtCOP(c.expenseEntries.length > 0 ? c.gastos : null),
          fmtPct(
            c.ingresos > 0 && c.expenseEntries.length > 0 ? (c.gastos / c.ingresos) * 100 : null,
          ),
        ],
        ...(c.otrosIngresosOperativos !== 0
          ? [["Otros ingresos operativos", fmtCOP(c.otrosIngresosOperativos), "—"]]
          : []),
        ...(c.ingresosFinancieros !== 0
          ? [["Ingresos financieros", fmtCOP(c.ingresosFinancieros), "—"]]
          : []),
        ...(c.gastosFinancieros !== 0
          ? [["Gastos financieros", fmtCOP(c.gastosFinancieros), "—"]]
          : []),
        ...(c.hasProfitBeforeTax
          ? [["Utilidad antes de impuestos", fmtCOP(c.utilidadAntesImpuestos), "—"]]
          : []),
        ...(c.hasIncomeTax ? [["Impuesto de renta reportado", fmtCOP(c.impuestoRenta), "—"]] : []),
        ["Utilidad neta", fmtCOP(c.hasNetIncome ? c.utilidadNeta : null), fmtPct(margenNeto)],
      ],
      columnStyles: { 1: { halign: "right", fontStyle: "bold" }, 2: { halign: "right" } },
    });
  }
  y = tableEnd(doc);

  /* --- Indicadores --- */
  y = section(doc, y, "5", "Indicadores financieros");
  const indicators = type === "balance" ? computeBalanceIndicators(c) : computePnLIndicators(c);
  y = indicatorsTable(doc, y, indicators.slice(0, 10));

  /* --- Tributario: solo donde aplica --- */
  y = section(doc, y, "6", "Informacion tributaria disponible");
  if (type === "pnl" && c.ingresos > 0) {
    const tax = buildTaxProjection(c.hasIncomeTax ? c.impuestoRenta : undefined);
    y = taxTable(doc, y, tax);
    y = paragraph(doc, y, tax.note);
  } else {
    y = paragraph(
      doc,
      y,
      "En un balance patrimonial no se calcula IVA ni renta sobre activos totales. " +
        "Los impuestos se proyectan sobre ingresos y utilidad del P&L. " +
        "Revise depreciacion de activos fijos (Art. 136-137 ET) como deduccion en renta.",
    );
  }

  y = section(doc, y, "7", "Oportunidades de ahorro fiscal");
  y = savingsTable(doc, y, buildFiscalSavingsRows(totals, profile, type));

  if (c.otherEntries.length > 0) {
    y = section(doc, y, "8", "Partidas OCR sin clasificar (revisar manualmente)");
    drawTable(doc, {
      startY: y,
      head: [["Concepto detectado", "Valor"]],
      body: c.otherEntries
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 15)
        .map(([k, v]) => [k, fmtCOP(v)]),
      columnStyles: { 0: { cellWidth: 110 }, 1: { halign: "right" } },
    });
    y = tableEnd(doc);
  }

  y = section(doc, y, c.otherEntries.length > 0 ? "9" : "8", "Analisis LEX AI");
  y = analysisMarkdown.trim()
    ? renderMarkdown(doc, y, analysisMarkdown)
    : paragraph(
        doc,
        y,
        "El análisis de LEX AI no se ha ejecutado. Este reporte incluye las cifras extraídas, validaciones financieras y oportunidades tributarias orientativas.",
      );

  footer(doc);
  downloadPdf(doc, `analisis-${docType}-${Date.now()}.pdf`);
}

export function generateBalanceReport(args: {
  profile: ReportProfile;
  datos: DatosFinancierosGlobales;
}) {
  const { profile, datos } = args;
  const c = classifyTotals({
    "Total activos": datos.activos,
    "Activos corrientes": datos.activosCorrientes,
    "Activos no corrientes": datos.activosNoCorrientes,
    "Total pasivos": datos.pasivos,
    "Pasivos corrientes": datos.pasivosCorrientes,
    "Pasivos no corrientes": datos.pasivosNoCorrientes,
    Patrimonio: datos.patrimonio,
  });

  const capitalTrabajo =
    c.hasCurrentAssets && c.hasCurrentLiabilities
      ? datos.activosCorrientes - datos.pasivosCorrientes
      : null;
  const dif = Math.abs(datos.activos - (datos.pasivos + datos.patrimonio));
  const canVerifyEquation = c.hasTotalAssets && c.hasTotalLiabilities && c.hasEquity;
  const cuadra = canVerifyEquation && dif <= Math.max(1, datos.activos * 0.01);
  const indicators = computeBalanceIndicators(c);

  const doc = new jsPDF();
  let y = header(
    doc,
    "Estado de situacion financiera",
    "Balance general, indicadores de liquidez y solvencia, implicaciones tributarias.",
    profile,
    "BALANCE",
  );

  y = section(doc, y, "1", "Resumen patrimonial");
  y = kpiGrid(doc, y, [
    { label: "Activos", value: fmtOptionalCompact(c.hasTotalAssets ? datos.activos : null) },
    { label: "Pasivos", value: fmtOptionalCompact(c.hasTotalLiabilities ? datos.pasivos : null) },
    { label: "Patrimonio", value: fmtOptionalCompact(c.hasEquity ? datos.patrimonio : null) },
    { label: "Capital de trabajo", value: fmtOptionalCompact(capitalTrabajo) },
  ]);

  y = diagnosis(
    doc,
    y,
    !canVerifyEquation
      ? "No se puede verificar A = P + Patrimonio porque faltan uno o mas totales."
      : cuadra
        ? `Balance cuadrado. Capital de trabajo: ${fmtCOP(capitalTrabajo)}.`
        : `Descuadre de ${fmtCOP(dif)} entre activos y (pasivos + patrimonio).`,
    !canVerifyEquation
      ? "warn"
      : cuadra
        ? capitalTrabajo != null && capitalTrabajo >= 0
          ? "ok"
          : "warn"
        : "bad",
  );

  y = section(doc, y, "2", "Balance general");
  drawTable(doc, {
    startY: y,
    head: [["Rubro", "Corriente", "No corriente", "Total"]],
    body: [
      [
        "Activos",
        fmtCOP(c.hasCurrentAssets ? datos.activosCorrientes : null),
        fmtCOP(c.hasNonCurrentAssets ? datos.activosNoCorrientes : null),
        fmtCOP(c.hasTotalAssets ? datos.activos : null),
      ],
      [
        "Pasivos",
        fmtCOP(c.hasCurrentLiabilities ? datos.pasivosCorrientes : null),
        fmtCOP(c.hasNonCurrentLiabilities ? datos.pasivosNoCorrientes : null),
        fmtCOP(c.hasTotalLiabilities ? datos.pasivos : null),
      ],
      ["Patrimonio", "—", "—", fmtCOP(c.hasEquity ? datos.patrimonio : null)],
      [
        "Verificacion A = P + Pat",
        "—",
        "—",
        canVerifyEquation ? (cuadra ? "Cuadra" : fmtCOP(dif)) : "N/D",
      ],
    ],
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right", fontStyle: "bold" },
    },
  });
  y = tableEnd(doc);

  y = section(doc, y, "3", "Indicadores financieros");
  y = indicatorsTable(doc, y, indicators);

  y = section(doc, y, "4", "Implicaciones tributarias");
  y = bullets(doc, y, [
    "El balance no genera impuesto directo; la renta se calcula sobre utilidad del P&L.",
    datos.activosNoCorrientes > 0
      ? `Activos fijos (~${fmtCOP(datos.activosNoCorrientes)}): revise depreciacion deducible (Arts. 136-137 ET).`
      : "Identifique activos depreciables para deduccion en renta.",
    "Patrimonio y pasivos determinan capacidad de endeudamiento y distribucion de dividendos (Arts. 48-49 ET).",
    "Mantenga cuadre contable para informacion exogena y medios magneticos DIAN.",
  ]);

  y = section(doc, y, "5", "Oportunidades de ahorro fiscal");
  y = savingsTable(doc, y, buildFiscalSavingsRows(null, profile, "balance", datos));

  y = section(doc, y, "6", "Recomendaciones");
  y = bullets(doc, y, [
    cuadra
      ? "Mantenga conciliacion mensual de activos, pasivos y patrimonio."
      : "Corrija el descuadre antes de presentar estados financieros.",
    "Meta de liquidez corriente: 1,5x o superior.",
    capitalTrabajo == null
      ? "Complete activos y pasivos corrientes para calcular capital de trabajo."
      : capitalTrabajo < 0
        ? "Capital de trabajo negativo: renegocie plazos o acelere cobranza."
        : "Preserve liquidez para ciclo operativo.",
  ]);

  footer(doc);
  doc.save(`balance-${Date.now()}.pdf`);
}

export function generatePnLReport(args: {
  profile: ReportProfile;
  datos: DatosFinancierosGlobales;
}) {
  const { profile, datos } = args;
  const hasIncomeTax =
    datos.source === "ocr" ? datos.tieneImpuestoRenta === true : datos.impuestoRenta != null;
  const hasNetIncome =
    datos.source === "ocr" ? datos.tieneUtilidadNeta === true : datos.utilidadNeta != null;
  const gastoOperativo = Math.max(
    0,
    datos.gastos - (datos.gastosFinancieros ?? 0) - (hasIncomeTax ? (datos.impuestoRenta ?? 0) : 0),
  );
  const totals: Record<string, number> = {
    "Ingresos operacionales": datos.ingresos,
    "Costo de ventas": -datos.costos,
    "Gastos operacionales": -gastoOperativo,
  };
  if (datos.otrosIngresosOperativos)
    totals["Otros ingresos operativos"] = datos.otrosIngresosOperativos;
  if (datos.ingresosFinancieros) totals["Ingresos financieros"] = datos.ingresosFinancieros;
  if (datos.gastosFinancieros) totals["Gastos financieros"] = -datos.gastosFinancieros;
  if (hasIncomeTax) totals["Impuesto de renta"] = -(datos.impuestoRenta ?? 0);
  if (datos.utilidadBruta != null) totals["Utilidad bruta"] = datos.utilidadBruta;
  if (datos.utilidadOperativa != null) totals["Utilidad operacional"] = datos.utilidadOperativa;
  if (datos.utilidadNeta != null && hasNetIncome) {
    totals["Utilidad neta"] = datos.utilidadNeta;
  }
  const c = classifyTotals(totals);
  const utilidadBruta = c.hasGrossProfit ? c.utilidadBruta : null;
  const utilidadNeta = c.hasNetIncome ? c.utilidadNeta : null;
  const hasIngresos = datos.source !== "ocr" || c.ingresosEntries.length > 0;
  const hasCostos = datos.source !== "ocr" || c.costEntries.length > 0;
  const hasGastos = datos.source !== "ocr" || c.expenseEntries.length > 0;
  const indicators = computePnLIndicators(c);
  const tax = buildTaxProjection(hasIncomeTax ? (datos.impuestoRenta ?? 0) : undefined);

  const doc = new jsPDF();
  let y = header(
    doc,
    "Estado de resultados (P&L)",
    "Rentabilidad, indicadores de eficiencia y datos tributarios reportados.",
    profile,
    "P&L",
  );

  const mb =
    utilidadBruta != null && datos.ingresos > 0 ? (utilidadBruta / datos.ingresos) * 100 : null;
  const mn =
    utilidadNeta != null && datos.ingresos > 0 ? (utilidadNeta / datos.ingresos) * 100 : null;

  y = section(doc, y, "1", "Resumen de resultados");
  y = kpiGrid(doc, y, [
    { label: "Ingresos", value: fmtOptionalCompact(hasIngresos ? datos.ingresos : null) },
    { label: "Costos", value: fmtOptionalCompact(hasCostos ? datos.costos : null) },
    {
      label: "Utilidad bruta",
      value: fmtOptionalCompact(utilidadBruta),
      hint: mb != null ? fmtPct(mb) : undefined,
    },
    {
      label: "Utilidad neta",
      value: fmtOptionalCompact(utilidadNeta),
      hint: mn != null ? fmtPct(mn) : undefined,
    },
  ]);

  y = diagnosis(
    doc,
    y,
    utilidadNeta == null
      ? "La utilidad neta no esta reportada o no puede determinarse con los datos disponibles."
      : utilidadNeta >= 0
        ? `Utilidad neta reportada ${fmtCOP(utilidadNeta)}. No se infiere una carga tributaria total.`
        : `Perdida neta reportada de ${fmtCOP(Math.abs(utilidadNeta))}. Revise estructura de costos y gastos.`,
    utilidadNeta == null
      ? "warn"
      : utilidadNeta >= 0
        ? mn != null && mn >= 8
          ? "ok"
          : "warn"
        : "bad",
  );
  if (utilidadBruta != null && datos.ingresos > 0 && datos.costos > 0) {
    const utilidadBrutaFormula = datos.ingresos - datos.costos;
    const difference = utilidadBruta - utilidadBrutaFormula;
    if (Math.abs(difference) > Math.max(1_000, Math.abs(utilidadBruta) * 0.001)) {
      y = diagnosis(
        doc,
        y,
        `Inconsistencia: utilidad bruta reportada ${fmtCOP(utilidadBruta)}; ingresos - costos = ${fmtCOP(utilidadBrutaFormula)} (diferencia ${fmtCOP(difference)}).`,
        "warn",
      );
    }
  }
  if (c.hasOperatingProfit && c.hasGrossProfit && c.expenseEntries.length > 0) {
    const formulaEbit = c.utilidadBruta - c.gastos + c.otrosIngresosOperativos;
    const difference = c.utilidadOperativa - formulaEbit;
    if (Math.abs(difference) > Math.max(1_000, Math.abs(c.utilidadOperativa) * 0.001)) {
      y = diagnosis(
        doc,
        y,
        `Inconsistencia: EBIT reportado ${fmtCOP(c.utilidadOperativa)}; utilidad bruta - gastos operativos + otros ingresos operativos = ${fmtCOP(formulaEbit)} (diferencia ${fmtCOP(difference)}).`,
        "warn",
      );
    }
  }
  if (c.hasProfitBeforeTax && c.hasIncomeTax && c.hasNetIncome) {
    const formulaNet = c.utilidadAntesImpuestos - c.impuestoRenta;
    const difference = c.utilidadNeta - formulaNet;
    if (Math.abs(difference) > Math.max(1_000, Math.abs(c.utilidadNeta) * 0.001)) {
      y = diagnosis(
        doc,
        y,
        `Inconsistencia: utilidad neta reportada ${fmtCOP(c.utilidadNeta)}; utilidad antes de impuestos - impuesto de renta = ${fmtCOP(formulaNet)} (diferencia ${fmtCOP(difference)}).`,
        "warn",
      );
    }
  }

  y = section(doc, y, "2", "Estado de resultados");
  drawTable(doc, {
    startY: y,
    head: [["Concepto", "Valor (COP)", "% ingresos"]],
    body: [
      [
        "(+) Ingresos operacionales",
        fmtCOP(hasIngresos ? datos.ingresos : null),
        hasIngresos ? "100%" : "N/D",
      ],
      [
        "(-) Costo de ventas",
        fmtCOP(hasCostos ? datos.costos : null),
        fmtPct(
          hasIngresos && hasCostos && datos.ingresos > 0
            ? (datos.costos / datos.ingresos) * 100
            : null,
        ),
      ],
      ["(=) Utilidad bruta", fmtCOP(utilidadBruta), fmtPct(mb)],
      [
        "(-) Gastos operacionales",
        fmtCOP(hasGastos ? gastoOperativo : null),
        fmtPct(
          hasIngresos && hasGastos && datos.ingresos > 0
            ? (gastoOperativo / datos.ingresos) * 100
            : null,
        ),
      ],
      ...(datos.gastosAdmin
        ? [["    Gastos administrativos", fmtCOP(datos.gastosAdmin), "—"]]
        : []),
      ...(datos.gastosVentas ? [["    Gastos de ventas", fmtCOP(datos.gastosVentas), "—"]] : []),
      ...(datos.gastosFinancieros
        ? [["    Gastos financieros", fmtCOP(datos.gastosFinancieros), "—"]]
        : []),
      ...(hasIncomeTax
        ? [["(-) Impuesto de renta reportado", fmtCOP(datos.impuestoRenta ?? 0), "—"]]
        : []),
      ...(c.hasProfitBeforeTax
        ? [["(=) Utilidad antes de impuestos", fmtCOP(c.utilidadAntesImpuestos), "—"]]
        : []),
      ["(=) Utilidad neta", fmtCOP(utilidadNeta), fmtPct(mn)],
    ],
    columnStyles: { 1: { halign: "right", fontStyle: "bold" }, 2: { halign: "right" } },
  });
  y = tableEnd(doc);

  y = section(doc, y, "3", "Indicadores de eficiencia");
  y = indicatorsTable(doc, y, indicators);

  y = section(doc, y, "4", "Informacion tributaria disponible");
  y = taxTable(doc, y, tax);
  y = paragraph(doc, y, tax.note);

  y = section(doc, y, "5", "Oportunidades de ahorro fiscal");
  y = savingsTable(
    doc,
    y,
    buildFiscalSavingsRows(
      {
        Ingresos: datos.ingresos,
        "Costo de ventas": datos.costos,
        Gastos: datos.gastos,
      },
      profile,
      "pnl",
      datos,
    ),
  );

  y = section(doc, y, "6", "Plan de accion");
  y = bullets(doc, y, [
    mb != null && mb < 30
      ? "Margen bruto bajo: renegocie costos o ajuste precios."
      : "Mantenga control de costos directos.",
    mn == null
      ? "Margen neto no disponible; valide utilidad neta y sus componentes antes de compararlo."
      : mn < 8
        ? "Margen neto por debajo del benchmark de referencia (8%): revise gastos operativos."
        : "Rentabilidad en rango aceptable.",
    "Documente deducciones con soporte (Art. 107 ET) antes del cierre fiscal.",
    "Concilie este P&L con balance y movimientos de caja.",
  ]);

  footer(doc);
  doc.save(`pnl-${Date.now()}.pdf`);
}

export function generateTransportTripReport(args: {
  profile: ReportProfile;
  trip: TransportTrip;
  targetMarginPct: number;
}) {
  const { profile, trip, targetMarginPct } = args;
  const metrics = computeTransportTripMetrics(trip, targetMarginPct);
  const fmtMeasure = (value: number) =>
    new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(value);
  const doc = new jsPDF();
  let y = header(
    doc,
    "Informe operativo y financiero de transporte",
    `${trip.origin} → ${trip.destination} · viaje del ${trip.tripDate}`,
    profile,
    "CALCUTRANS",
  );

  y = section(doc, y, "1", "Resumen del viaje");
  y = kpiGrid(doc, y, [
    { label: "Flete + recargos", value: fmtCOP(metrics.contractRevenueCop) },
    { label: "Costos directos registrados", value: fmtCOP(metrics.tripCostsCop) },
    { label: "Utilidad operativa estimada", value: fmtCOP(metrics.operatingProfitCop) },
    { label: "Margen operativo", value: fmtPct(metrics.operatingMarginPct) },
    { label: "Flete base de equilibrio", value: fmtOptionalCompact(metrics.breakEvenFreightCop) },
    {
      label: `Flete para margen objetivo (${targetMarginPct}%)`,
      value: fmtOptionalCompact(metrics.requiredFreightAtTargetCop),
    },
  ]);
  y = diagnosis(
    doc,
    y,
    metrics.tripCostsCop === 0
      ? "No se registraron costos directos. La utilidad equivale al flete capturado y no representa la rentabilidad completa."
      : metrics.operatingProfitCop < 0
        ? `El viaje presenta una pérdida operativa estimada de ${fmtCOP(Math.abs(metrics.operatingProfitCop))}, antes de costos fijos e impuestos.`
        : "Resultado positivo según los ingresos y costos directos registrados; no incluye costos fijos ni impuestos.",
    metrics.tripCostsCop === 0 ? "warn" : metrics.operatingProfitCop < 0 ? "bad" : "ok",
  );

  y = section(doc, y, "2", "Datos operativos");
  drawTable(doc, {
    startY: y,
    head: [["Dato", "Valor", "Dato", "Valor"]],
    body: [
      ["Fecha", trip.tripDate, "Ruta", `${trip.origin} → ${trip.destination}`],
      ["Vehículo", trip.vehiclePlate || "N/D", "Conductor", trip.driverName || "N/D"],
      [
        "Kilómetros cargado",
        `${fmtMeasure(trip.loadedKm)} km`,
        "Kilómetros vacío",
        `${fmtMeasure(trip.emptyKm)} km`,
      ],
      [
        "Distancia total",
        `${fmtMeasure(metrics.totalKm)} km`,
        "Combustible",
        `${fmtMeasure(trip.fuelLiters)} litros`,
      ],
      [
        "Capacidad útil",
        trip.capacityKg > 0 ? `${fmtMeasure(trip.capacityKg)} kg` : "N/D",
        "Peso manifestado",
        metrics.loadWeightKg > 0 ? `${fmtMeasure(metrics.loadWeightKg)} kg` : "N/D",
      ],
      [
        "Uso de capacidad",
        fmtPct(metrics.loadUtilizationPct),
        "Avance de entrega",
        fmtPct(metrics.deliveryProgressPct),
      ],
    ],
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      1: { cellWidth: 48 },
      2: { cellWidth: 42, fontStyle: "bold" },
      3: { cellWidth: 42 },
    },
  });
  y = tableEnd(doc);

  y = section(doc, y, "3", "Flete, recaudos y saldo del cliente");
  drawTable(doc, {
    startY: y,
    head: [["Concepto", "Valor COP"]],
    body: [
      ["Flete pactado", fmtCOP(trip.freightCop)],
      ["Recargos y servicios adicionales", fmtCOP(trip.surchargeCop)],
      ["Total contractual", fmtCOP(metrics.contractRevenueCop)],
      ["Anticipo recibido del cliente", fmtCOP(trip.customerAdvanceCop)],
      ["Pago final recibido", fmtCOP(trip.customerFinalPaymentCop)],
      ["Otros recaudos", fmtCOP(trip.otherCustomerCollectionCop)],
      ["Retenciones certificadas", fmtCOP(metrics.customerWithheldCop)],
      ["Saldo del cliente después de recaudos y retenciones", fmtCOP(metrics.customerBalanceCop)],
    ],
    columnStyles: { 1: { halign: "right", fontStyle: "bold", cellWidth: 50 } },
  });
  y = tableEnd(doc);

  y = section(doc, y, "4", "Costos directos y arqueo");
  drawTable(doc, {
    startY: y,
    head: [["Categoría", "Detalle / soporte", "Valor COP", "Sale de anticipo"]],
    body:
      trip.expenses.length === 0
        ? [["Sin costos registrados", "—", fmtCOP(0), "—"]]
        : trip.expenses.map((expense) => [
            expense.category,
            expense.note || "—",
            fmtCOP(expense.amountCop),
            expense.paidFromDriverCash ? "Sí" : "No",
          ]),
    columnStyles: {
      0: { cellWidth: 43 },
      1: { cellWidth: 64 },
      2: { halign: "right", cellWidth: 34 },
      3: { halign: "center", cellWidth: 29 },
    },
  });
  y = tableEnd(doc);
  drawTable(doc, {
    startY: y,
    head: [["Control de caja del conductor", "Valor COP"]],
    body: [
      ["Anticipo entregado", fmtCOP(trip.driverAdvanceCop)],
      ["Gastos pagados con anticipo", fmtCOP(metrics.cashExpensesCop)],
      ["Efectivo reintegrado", fmtCOP(trip.driverCashReturnedCop)],
      [
        "Diferencia por aclarar",
        trip.driverAdvanceCop + metrics.cashExpensesCop + trip.driverCashReturnedCop === 0
          ? "N/D · sin datos de caja"
          : fmtCOP(metrics.driverCashDifferenceCop),
      ],
    ],
    columnStyles: { 1: { halign: "right", fontStyle: "bold", cellWidth: 50 } },
  });
  y = tableEnd(doc);

  y = section(doc, y, "5", "Manifiesto auxiliar");
  drawTable(doc, {
    startY: y,
    head: [["Carga", "Remesa / referencia", "Bultos", "Peso kg", "Valor declarado", "Entrega"]],
    body:
      trip.cargoItems.length === 0
        ? [["Sin carga detallada", "—", "N/D", "N/D", "N/D", "N/D"]]
        : trip.cargoItems.map((item) => [
            item.description || "—",
            item.document || "—",
            String(item.packages),
            fmtMeasure(item.weightKg),
            fmtCOP(item.declaredValueCop),
            item.delivered ? "Entregada" : "Pendiente",
          ]),
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 35 },
      2: { halign: "right", cellWidth: 18 },
      3: { halign: "right", cellWidth: 21 },
      4: { halign: "right", cellWidth: 34 },
      5: { halign: "center", cellWidth: 24 },
    },
  });
  y = tableEnd(doc);

  y = section(doc, y, "6", "Indicadores de eficiencia");
  drawTable(doc, {
    startY: y,
    head: [["Indicador", "Resultado"]],
    body: [
      ["Costo por kilómetro total", fmtOptionalCompact(metrics.costPerKmCop)],
      [
        "Flete por tonelada-kilómetro cargada",
        fmtOptionalCompact(metrics.revenuePerLoadedTonKmCop),
      ],
      [
        "Rendimiento de combustible",
        metrics.fuelEfficiencyKmPerLiter === null
          ? "N/D"
          : `${metrics.fuelEfficiencyKmPerLiter.toFixed(2)} km/l`,
      ],
      ["Gasto en combustible", fmtCOP(metrics.fuelExpenseCop)],
      ["Costo por litro", fmtOptionalCompact(metrics.fuelCostPerLiterCop)],
    ],
    columnStyles: { 1: { halign: "right", fontStyle: "bold", cellWidth: 60 } },
  });
  y = tableEnd(doc);
  y = paragraph(
    doc,
    y,
    "Alcance: informe gerencial en COP calculado únicamente con los datos ingresados. No liquida impuestos, retenciones, costos financieros, depreciación ni costos fijos. El manifiesto es auxiliar y no reemplaza los documentos legales de transporte. La retención se refleja solo cuando se registra según certificado recibido.",
  );

  footer(doc);
  const safePart = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "viaje";
  downloadPdf(
    doc,
    `calcutrans-${trip.tripDate}-${safePart(trip.origin)}-${safePart(trip.destination)}.pdf`,
  );
}
