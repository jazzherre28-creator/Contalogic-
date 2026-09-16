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
function fmtCOP(n: number) {
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

function drawTable(doc: jsPDF, opts: Parameters<typeof autoTable>[1]) {
  autoTable(doc, {
    ...opts,
    headStyles: { ...TABLE_BASE.headStyles, ...(opts?.headStyles ?? {}) },
    styles: { ...TABLE_BASE.styles, ...(opts?.styles ?? {}) },
    alternateRowStyles: TABLE_BASE.alternateRowStyles,
    margin: TABLE_BASE.margin,
  });
}

/* ─── Proyección tributaria coherente (misma lógica que analytics) ─── */
type TaxRow = { concept: string; base: string; rate: string; amount: string; amountNum: number };

function buildTaxProjection(
  ingresos: number,
  costos: number,
  gastos: number,
  utilidadNeta: number,
  profile: ReportProfile,
): { rows: TaxRow[]; total: number; note: string } {
  const isJuridica = profile.entity_type === "juridica";
  const tarifaRenta = isJuridica ? 0.35 : 0.19;
  const baseGastos = costos + gastos;

  const ivaGen = ingresos * 0.19;
  const ivaDesc = baseGastos * 0.5 * 0.19;
  const ivaNeto = Math.max(0, ivaGen - ivaDesc);

  let rentaEst: number;
  let rentaLabel: string;
  let rentaRate: string;

  if (isJuridica) {
    rentaEst = Math.max(0, utilidadNeta) * tarifaRenta;
    rentaLabel = "Impuesto de renta (Art. 240 ET)";
    rentaRate = "35%";
  } else {
    rentaEst = Math.max(0, utilidadNeta) * tarifaRenta;
    rentaLabel = "Renta cedular (estimado)";
    rentaRate = "19%";
  }

  const ica = ingresos * 0.00966;
  const total = ivaNeto + rentaEst + ica;

  const rows: TaxRow[] = [
    { concept: "IVA generado", base: fmtCOP(ingresos), rate: "19%", amount: fmtCOP(ivaGen), amountNum: ivaGen },
    {
      concept: "IVA descontable (Art. 485 ET)",
      base: fmtCOP(baseGastos * 0.5),
      rate: "19%",
      amount: fmtCOP(ivaDesc),
      amountNum: ivaDesc,
    },
    { concept: "IVA neto a pagar", base: "—", rate: "—", amount: fmtCOP(ivaNeto), amountNum: ivaNeto },
    {
      concept: rentaLabel,
      base: fmtCOP(Math.max(0, utilidadNeta)),
      rate: rentaRate,
      amount: fmtCOP(rentaEst),
      amountNum: rentaEst,
    },
    {
      concept: "ICA (referencia Bogotá)",
      base: fmtCOP(ingresos),
      rate: "0,966%",
      amount: fmtCOP(ica),
      amountNum: ica,
    },
    { concept: "Total impuestos estimados", base: "—", rate: "—", amount: fmtCOP(total), amountNum: total },
  ];

  const note =
    ingresos <= 0 && utilidadNeta <= 0
      ? "No hay base gravable suficiente para estimar impuestos. Este apartado aplica cuando existen ingresos o utilidad en el periodo."
      : isJuridica
        ? "Estimación orientativa bajo régimen ordinario. Las deducciones del Art. 107 ET pueden reducir la base de renta. No incluye retenciones (anticipo de impuesto)."
        : "Estimación orientativa. Compare RST vs. régimen ordinario con su contador. No incluye retenciones practicadas.";

  return { rows, total, note };
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
    doc.text("Confidencial · Contalogic AI+ · Estatuto Tributario Colombiano (referencia)", M, FOOTER);
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
    wrap(doc, item.label.toUpperCase(), cw - 8).forEach((l, li) => doc.text(l, x + 4, yy + 6 + li * 3.2));

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
    head: [["Impuesto", "Base gravable", "Tarifa", "Estimado"]],
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
    "Resumen de movimientos, indicadores y proyeccion tributaria del periodo.",
    profile,
    "FINANZAS",
  );

  const margen = totals.income > 0 ? (totals.balance / totals.income) * 100 : null;
  const tax = buildTaxProjection(totals.income, totals.expense, 0, totals.balance, profile);

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
      ? `Flujo positivo. Impuestos estimados del periodo: ${fmtCOP(tax.total)}.`
      : `Deficit de ${fmtCOP(Math.abs(totals.balance))}. Revise egresos antes de proyectar tributos.`,
    totals.balance >= 0 ? "ok" : "bad",
  );

  y = section(doc, y, "2", "Proyeccion tributaria");
  y = taxTable(doc, y, tax);
  y = paragraph(doc, y, tax.note);

  y = section(doc, y, "3", "Oportunidades de ahorro fiscal");
  y = savingsTable(
    doc,
    y,
    buildFiscalSavingsRows(
      { Ingresos: totals.income, Gastos: totals.expense },
      profile,
      "pnl",
    ),
  );

  footer(doc);
  doc.save(`informe-financiero-${Date.now()}.pdf`);
}

export function generateCalculatorReport(args: {
  profile: ReportProfile;
  records: Array<{ category: string; amount: number; kind: string; note: string | null; recorded_at: string }>;
}) {
  const { profile, records } = args;
  const sorted = [...records].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());

  let income = 0;
  let expense = 0;
  records.forEach((r) => {
    if (r.kind === "income") income += Number(r.amount);
    else expense += Number(r.amount);
  });
  const balance = income - expense;
  const margen = income > 0 ? (balance / income) * 100 : null;

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
    "Libro auxiliar de movimientos",
    "Detalle por categoria, conciliacion y efecto tributario estimado.",
    profile,
    "CALCULADORA",
  );

  const tax = buildTaxProjection(income, expense, 0, balance, profile);

  y = section(doc, y, "1", "Resumen");
  y = kpiGrid(doc, y, [
    { label: "Ingresos", value: fmtCompact(income) },
    { label: "Egresos", value: fmtCompact(expense) },
    { label: "Saldo neto", value: fmtCompact(balance), hint: margen != null ? fmtPct(margen) : undefined },
    { label: "Registros", value: String(records.length) },
  ]);

  y = section(doc, y, "2", "Consolidado por categoria");
  drawTable(doc, {
    startY: y,
    head: [["Categoria", "Ingresos", "Egresos", "Neto"]],
    body: [...byCat.entries()]
      .sort((a, b) => b[1].in + b[1].out - (a[1].in + a[1].out))
      .map(([cat, v]) => [cat, fmtCOP(v.in), fmtCOP(v.out), fmtCOP(v.in - v.out)]),
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
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

  y = section(doc, y, "4", "Proyeccion tributaria");
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
  analysisMarkdown: string;
}) {
  const { profile, fileName, docType, totals, analysisMarkdown } = args;
  const type = docType === "balance" ? "balance" : "pnl";
  const c = classifyTotals(totals);
  const quality = dataQualityScore(Object.keys(totals).filter((k) => totals[k] !== 0).length);

  const doc = new jsPDF();
  const docLabel = type === "balance" ? "Estado de situacion financiera" : "Estado de resultados (P&L)";

  let y = header(
    doc,
    "Analisis OCR",
    `${docLabel} · ${fileName}`,
    profile,
    "ESCANER",
  );

  /* --- KPIs segun tipo de documento --- */
  y = section(doc, y, "1", "Cifras principales");
  if (type === "balance") {
    y = kpiGrid(doc, y, [
      { label: "Total activos", value: fmtCompact(c.activos), hint: fmtCOP(c.activos) },
      { label: "Total pasivos", value: fmtCompact(c.pasivos), hint: fmtCOP(c.pasivos) },
      { label: "Patrimonio", value: fmtCompact(c.patrimonio), hint: fmtCOP(c.patrimonio) },
      {
        label: "Capital de trabajo",
        value: fmtCompact(c.activosCorrientes - c.pasivosCorrientes),
        hint: "Activos corrientes - Pasivos corrientes",
      },
    ]);
    const dif = Math.abs(c.activos - (c.pasivos + c.patrimonio));
    const cuadra = c.activos === 0 || dif <= c.activos * 0.05;
    y = diagnosis(
      doc,
      y,
      cuadra
        ? "La ecuacion contable (Activos = Pasivos + Patrimonio) cuadra dentro de tolerancia."
        : `Descuadre detectado: ${fmtCOP(dif)}. Valide totales antes de usar el informe.`,
      cuadra ? "ok" : "warn",
    );
  } else {
    const utilidad = c.ingresos - c.costos - c.gastos;
    const mb = c.ingresos > 0 ? ((c.ingresos - c.costos) / c.ingresos) * 100 : null;
    const mn = c.ingresos > 0 ? (utilidad / c.ingresos) * 100 : null;
    y = kpiGrid(doc, y, [
      { label: "Ingresos", value: fmtCompact(c.ingresos) },
      { label: "Costos", value: fmtCompact(c.costos) },
      { label: "Gastos", value: fmtCompact(c.gastos) },
      { label: "Utilidad neta", value: fmtCompact(utilidad), hint: mn != null ? `Margen ${fmtPct(mn)}` : undefined },
    ]);
    y = diagnosis(
      doc,
      y,
      mb != null
        ? `Margen bruto ${fmtPct(mb)} · Utilidad neta ${fmtCOP(utilidad)}.`
        : "Datos de ingresos insuficientes para calcular margenes.",
      utilidad >= 0 ? "ok" : "bad",
    );
  }

  y = paragraph(doc, y, quality.insight);

  /* --- Tabla estructurada (no mezclar partidas crudas) --- */
  y = section(doc, y, "2", type === "balance" ? "Estructura patrimonial" : "Estado de resultados");

  if (type === "balance") {
    drawTable(doc, {
      startY: y,
      head: [["Rubro", "Valor (COP)"]],
      body: [
        ["Activos corrientes", fmtCOP(c.activosCorrientes)],
        ["Activos no corrientes", fmtCOP(c.activosNoCorrientes)],
        ["Total activos", fmtCOP(c.activos)],
        ["Pasivos corrientes", fmtCOP(c.pasivosCorrientes)],
        ["Pasivos no corrientes", fmtCOP(c.pasivosNoCorrientes)],
        ["Total pasivos", fmtCOP(c.pasivos)],
        ["Patrimonio", fmtCOP(c.patrimonio)],
        ["Pasivos + Patrimonio", fmtCOP(c.pasivos + c.patrimonio)],
      ],
      columnStyles: { 0: { cellWidth: 90 }, 1: { halign: "right", fontStyle: "bold" } },
    });
  } else {
    const utilidad = c.ingresos - c.costos - c.gastos;
    drawTable(doc, {
      startY: y,
      head: [["Concepto", "Valor (COP)", "% s/ ingresos"]],
      body: [
        ["Ingresos operacionales", fmtCOP(c.ingresos), "100%"],
        ["Costo de ventas", fmtCOP(c.costos), fmtPct(c.ingresos > 0 ? (c.costos / c.ingresos) * 100 : null)],
        ["Utilidad bruta", fmtCOP(c.ingresos - c.costos), fmtPct(c.ingresos > 0 ? ((c.ingresos - c.costos) / c.ingresos) * 100 : null)],
        ["Gastos operacionales", fmtCOP(c.gastos), fmtPct(c.ingresos > 0 ? (c.gastos / c.ingresos) * 100 : null)],
        ["Utilidad neta", fmtCOP(utilidad), fmtPct(c.ingresos > 0 ? (utilidad / c.ingresos) * 100 : null)],
      ],
      columnStyles: { 1: { halign: "right", fontStyle: "bold" }, 2: { halign: "right" } },
    });
  }
  y = tableEnd(doc);

  /* --- Indicadores --- */
  y = section(doc, y, "3", "Indicadores financieros");
  const indicators = type === "balance" ? computeBalanceIndicators(c) : computePnLIndicators(c);
  y = indicatorsTable(doc, y, indicators.slice(0, 10));

  /* --- Tributario: solo donde aplica --- */
  y = section(doc, y, "4", "Proyeccion tributaria");
  if (type === "pnl" && c.ingresos > 0) {
    const utilidad = c.ingresos - c.costos - c.gastos;
    const tax = buildTaxProjection(c.ingresos, c.costos, c.gastos, utilidad, profile);
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

  y = section(doc, y, "5", "Oportunidades de ahorro fiscal");
  y = savingsTable(doc, y, buildFiscalSavingsRows(totals, profile, type));

  if (c.otherEntries.length > 0) {
    y = section(doc, y, "6", "Partidas OCR sin clasificar (revisar manualmente)");
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

  y = section(doc, y, c.otherEntries.length > 0 ? "7" : "6", "Analisis LEX AI");
  y = renderMarkdown(doc, y, analysisMarkdown);

  footer(doc);
  doc.save(`analisis-${docType}-${Date.now()}.pdf`);
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

  const capitalTrabajo = datos.activosCorrientes - datos.pasivosCorrientes;
  const dif = Math.abs(datos.activos - (datos.pasivos + datos.patrimonio));
  const cuadra = datos.activos === 0 || dif <= datos.activos * 0.01;
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
    { label: "Activos", value: fmtCompact(datos.activos) },
    { label: "Pasivos", value: fmtCompact(datos.pasivos) },
    { label: "Patrimonio", value: fmtCompact(datos.patrimonio) },
    { label: "Capital de trabajo", value: fmtCompact(capitalTrabajo) },
  ]);

  y = diagnosis(
    doc,
    y,
    cuadra
      ? `Balance cuadrado. Capital de trabajo: ${fmtCOP(capitalTrabajo)}.`
      : `Descuadre de ${fmtCOP(dif)} entre activos y (pasivos + patrimonio).`,
    cuadra ? (capitalTrabajo >= 0 ? "ok" : "warn") : "bad",
  );

  y = section(doc, y, "2", "Balance general");
  drawTable(doc, {
    startY: y,
    head: [["Rubro", "Corriente", "No corriente", "Total"]],
    body: [
      ["Activos", fmtCOP(datos.activosCorrientes), fmtCOP(datos.activosNoCorrientes), fmtCOP(datos.activos)],
      ["Pasivos", fmtCOP(datos.pasivosCorrientes), fmtCOP(datos.pasivosNoCorrientes), fmtCOP(datos.pasivos)],
      ["Patrimonio", "—", "—", fmtCOP(datos.patrimonio)],
      ["Verificacion A = P + Pat", "—", "—", cuadra ? "Cuadra" : fmtCOP(dif)],
    ],
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right", fontStyle: "bold" } },
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
    cuadra ? "Mantenga conciliacion mensual de activos, pasivos y patrimonio." : "Corrija el descuadre antes de presentar estados financieros.",
    "Meta de liquidez corriente: 1,5x o superior.",
    capitalTrabajo < 0 ? "Capital de trabajo negativo: renegocie plazos o acelere cobranza." : "Preserve liquidez para ciclo operativo.",
  ]);

  footer(doc);
  doc.save(`balance-${Date.now()}.pdf`);
}

export function generatePnLReport(args: {
  profile: ReportProfile;
  datos: DatosFinancierosGlobales;
}) {
  const { profile, datos } = args;
  const utilidadBruta = datos.ingresos - datos.costos;
  const utilidadNeta = datos.ingresos - datos.costos - datos.gastos;
  const c = classifyTotals({
    Ingresos: datos.ingresos,
    "Costo de ventas": datos.costos,
    "Gastos operacionales": datos.gastos,
  });
  const indicators = computePnLIndicators(c);
  const tax = buildTaxProjection(datos.ingresos, datos.costos, datos.gastos, utilidadNeta, profile);

  const doc = new jsPDF();
  let y = header(
    doc,
    "Estado de resultados (P&L)",
    "Rentabilidad, indicadores de eficiencia, proyeccion tributaria y ahorro fiscal.",
    profile,
    "P&L",
  );

  const mb = datos.ingresos > 0 ? (utilidadBruta / datos.ingresos) * 100 : null;
  const mn = datos.ingresos > 0 ? (utilidadNeta / datos.ingresos) * 100 : null;

  y = section(doc, y, "1", "Resumen de resultados");
  y = kpiGrid(doc, y, [
    { label: "Ingresos", value: fmtCompact(datos.ingresos) },
    { label: "Costos", value: fmtCompact(datos.costos) },
    { label: "Utilidad bruta", value: fmtCompact(utilidadBruta), hint: mb != null ? fmtPct(mb) : undefined },
    { label: "Utilidad neta", value: fmtCompact(utilidadNeta), hint: mn != null ? fmtPct(mn) : undefined },
  ]);

  y = diagnosis(
    doc,
    y,
    utilidadNeta >= 0
      ? `Utilidad neta ${fmtCOP(utilidadNeta)}. Impuestos estimados: ${fmtCOP(tax.total)} (${datos.ingresos > 0 ? fmtPct((tax.total / datos.ingresos) * 100) : "N/D"} s/ ingresos).`
      : `Perdida operativa de ${fmtCOP(Math.abs(utilidadNeta))}. Revise estructura de costos y gastos.`,
    utilidadNeta >= 0 ? (mn != null && mn >= 8 ? "ok" : "warn") : "bad",
  );

  y = section(doc, y, "2", "Estado de resultados");
  drawTable(doc, {
    startY: y,
    head: [["Concepto", "Valor (COP)", "% ingresos"]],
    body: [
      ["(+) Ingresos operacionales", fmtCOP(datos.ingresos), "100%"],
      ["(-) Costo de ventas", fmtCOP(datos.costos), fmtPct(datos.ingresos > 0 ? (datos.costos / datos.ingresos) * 100 : null)],
      ["(=) Utilidad bruta", fmtCOP(utilidadBruta), fmtPct(mb)],
      ["(-) Gastos operacionales", fmtCOP(datos.gastos), fmtPct(datos.ingresos > 0 ? (datos.gastos / datos.ingresos) * 100 : null)],
      ...(datos.gastosAdmin ? [["    Gastos administrativos", fmtCOP(datos.gastosAdmin), "—"]] : []),
      ...(datos.gastosVentas ? [["    Gastos de ventas", fmtCOP(datos.gastosVentas), "—"]] : []),
      ...(datos.gastosFinancieros ? [["    Gastos financieros", fmtCOP(datos.gastosFinancieros), "—"]] : []),
      ["(=) Utilidad neta", fmtCOP(utilidadNeta), fmtPct(mn)],
    ],
    columnStyles: { 1: { halign: "right", fontStyle: "bold" }, 2: { halign: "right" } },
  });
  y = tableEnd(doc);

  y = section(doc, y, "3", "Indicadores de eficiencia");
  y = indicatorsTable(doc, y, indicators);

  y = section(doc, y, "4", "Proyeccion tributaria");
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
    mb != null && mb < 30 ? "Margen bruto bajo: renegocie costos o ajuste precios." : "Mantenga control de costos directos.",
    mn != null && mn < 8 ? "Margen neto por debajo del benchmark (8%): reduzca gastos operativos." : "Rentabilidad en rango aceptable.",
    "Documente deducciones con soporte (Art. 107 ET) antes del cierre fiscal.",
    "Concilie este P&L con balance y movimientos de caja.",
  ]);

  footer(doc);
  doc.save(`pnl-${Date.now()}.pdf`);
}
