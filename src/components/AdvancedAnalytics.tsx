import { useMemo, useState } from "react";
import { useFinance } from "@/lib/finance-context";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Area,
} from "recharts";
import type { ReportProfile } from "@/lib/pdf-report";
import {
  classifyTotals,
  dataQualityScore,
  computeBalanceIndicators,
  computePnLIndicators,
  computeBalanceScenarios,
  computePnLScenarios,
  type IndicatorRow,
  type ScenarioRow,
} from "@/lib/financial-analytics";
import { TaxSavingsPanel } from "@/components/TaxSavingsPanel";

const COLORS = ["#2563eb", "#10b981", "#eab308", "#ef4444", "#a855f7", "#0ea5e9", "#f97316", "#14b8a6"];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const fmtCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const tooltipStyle = { background: "#0a0a14", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8 };

export type ProjectionRow = { concept: string; base: string; rate: string; value: string; valueNum: number };

export function computeAdvancedAnalytics(
  totals: Record<string, number>,
  profile: ReportProfile,
  docType: "balance" | "pnl" = "pnl"
) {
  const entries = Object.entries(totals).filter(([, v]) => v !== 0);
  const c = classifyTotals(totals);
  const {
    ingresos,
    costos,
    gastos,
    activos,
    pasivos,
    patrimonio,
    activosCorrientes,
    pasivosCorrientes,
    costEntries,
    expenseEntries,
    balanceEntries,
    otherEntries,
  } = c;

  const utilidadBruta = Math.max(0, ingresos - costos);
  const utilidadNeta = ingresos - costos - gastos;
  const margenBruto = ingresos > 0 ? (utilidadBruta / ingresos) * 100 : 0;
  const margenNeto = ingresos > 0 ? (utilidadNeta / ingresos) * 100 : 0;
  const liquidez = pasivos > 0 ? activos / pasivos : 0;
  const endeudamiento = activos > 0 ? (pasivos / activos) * 100 : 0;
  const equidadRatio = activos > 0 ? (patrimonio / activos) * 100 : 0;
  const capitalTrabajo = activosCorrientes - pasivosCorrientes;
  const liquidezCorriente = pasivosCorrientes > 0 ? activosCorrientes / pasivosCorrientes : 0;
  const costRatio = ingresos > 0 ? (costos / ingresos) * 100 : 0;
  const expenseRatio = ingresos > 0 ? (gastos / ingresos) * 100 : 0;

  const isJuridica = profile.entity_type === "juridica";
  const tarifaRenta = isJuridica ? 0.35 : 0.19;
  const ivaGenerado = ingresos * 0.19;
  const ivaDescontable = (costos + gastos) * 0.5 * 0.19;
  const ivaNeto = Math.max(0, ivaGenerado - ivaDescontable);
  const rentaEstimada = Math.max(0, utilidadNeta) * tarifaRenta;
  const ica = ingresos * 0.00966;
  const totalImpuestos = ivaNeto + rentaEstimada + ica;
  const impuestoRatio = ingresos > 0 ? (totalImpuestos / ingresos) * 100 : 0;
  const ahorroIVA = ivaDescontable;
  const ahorroDeducc = Math.max(0, gastos * 0.08) * tarifaRenta;
  const ahorroRST = isJuridica ? 0 : Math.max(0, rentaEstimada - ingresos * 0.055);
  const quality = dataQualityScore(entries.length);

  const formattedCostDetails = costEntries
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, pct: ingresos > 0 ? (value / ingresos) * 100 : 0 }));
  const formattedExpenseDetails = expenseEntries
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, pct: ingresos > 0 ? (value / ingresos) * 100 : 0 }));
  const balanceDetails = balanceEntries
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, pct: activos > 0 ? (value / activos) * 100 : 0 }));

  const allEntries = entries
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([name, value]) => {
      const totalAbs = entries.reduce((s, [, v]) => s + Math.abs(v), 0);
      return { name, value, pct: totalAbs > 0 ? (Math.abs(value) / totalAbs) * 100 : 0 };
    });

  const projection: ProjectionRow[] = [
    { concept: "IVA generado (Art. 420 ET)", base: fmtCOP(ingresos), rate: "19%", value: fmtCOP(ivaGenerado), valueNum: ivaGenerado },
    { concept: "IVA descontable (Art. 485 ET)", base: fmtCOP((costos + gastos) * 0.5), rate: "19%", value: fmtCOP(ivaDescontable), valueNum: ivaDescontable },
    { concept: "IVA neto a pagar", base: "—", rate: "—", value: fmtCOP(ivaNeto), valueNum: ivaNeto },
    { concept: `Renta (${isJuridica ? "Art. 240 ET 35%" : "cedular 19%"})`, base: fmtCOP(Math.max(0, utilidadNeta)), rate: isJuridica ? "35%" : "19%", value: fmtCOP(rentaEstimada), valueNum: rentaEstimada },
    { concept: "ICA servicios (9.66x1000)", base: fmtCOP(ingresos), rate: "0.966%", value: fmtCOP(ica), valueNum: ica },
    { concept: "Total carga tributaria estimada", base: "—", rate: "—", value: fmtCOP(totalImpuestos), valueNum: totalImpuestos },
  ];

  const savings = [
    { name: "IVA descontable", value: ahorroIVA },
    { name: "Deducciones Art. 107", value: ahorroDeducc },
    { name: "Optimización RST", value: Math.max(0, ahorroRST) },
  ].filter((s) => s.value > 0);

  const marginWaterfall =
    docType === "pnl" && ingresos > 0
      ? [
          { name: "Ingresos", value: ingresos, fill: "#10b981" },
          { name: "Costos", value: -costos, fill: "#ef4444" },
          { name: "Gastos", value: -gastos, fill: "#f97316" },
          { name: "Utilidad", value: utilidadNeta, fill: utilidadNeta >= 0 ? "#2563eb" : "#ef4444" },
        ]
      : [];

  const balanceRadar = [
    { name: "Activos", value: activos },
    { name: "Pasivos", value: pasivos },
    { name: "Patrimonio", value: patrimonio },
  ];

  const chartInsights =
    docType === "balance"
      ? [
          `Activos: ${fmtCOP(activos)} · Pasivos: ${fmtCOP(pasivos)} · Patrimonio: ${fmtCOP(patrimonio)}.`,
          `Liquidez A/P: ${liquidez.toFixed(2)}x · Endeudamiento: ${endeudamiento.toFixed(1)}% · Capital de trabajo: ${fmtCOP(capitalTrabajo)}.`,
          pasivosCorrientes > 0
            ? `Liquidez corriente: ${liquidezCorriente.toFixed(2)}x (activos corrientes / pasivos corrientes).`
            : "No se detectaron pasivos corrientes con claridad.",
          quality.insight,
        ]
      : [
          `Ingresos: ${fmtCOP(ingresos)} · Costos: ${fmtCOP(costos)} · Gastos: ${fmtCOP(gastos)}.`,
          `Utilidad bruta ${margenBruto.toFixed(1)}% · Utilidad neta ${margenNeto.toFixed(1)}%.`,
          `Carga tributaria estimada: ${fmtCOP(totalImpuestos)} (${impuestoRatio.toFixed(1)}% sobre ingresos).`,
          otherEntries.length > 0
            ? `${otherEntries.length} partidas sin clasificar automática — revisa la pestaña Datos.`
            : quality.insight,
        ];

  const dashboardChartData =
    docType === "balance"
      ? balanceRadar
      : [
          { name: "Ingresos", value: ingresos },
          { name: "Costos", value: costos },
          { name: "Gastos", value: gastos },
        ];

  const balanceIndicators = docType === "balance" ? computeBalanceIndicators(c) : [];
  const pnlIndicators = docType === "pnl" ? computePnLIndicators(c) : [];
  const balanceScenarios = docType === "balance" ? computeBalanceScenarios(c) : [];
  const pnlScenarios = docType === "pnl" ? computePnLScenarios(c) : [];

  const indicatorRadar =
    docType === "balance"
      ? balanceIndicators
          .filter((i) => i.value != null && typeof i.value === "number" && i.id !== "cuadre")
          .slice(0, 6)
          .map((i) => ({
            name: i.name.length > 14 ? i.name.slice(0, 14) + "…" : i.name,
            value: Math.min(100, Math.max(0, Math.abs(i.value as number) * (i.display.includes("%") ? 1 : 10))),
          }))
      : pnlIndicators
          .filter((i) => i.value != null && i.display.includes("%"))
          .slice(0, 6)
          .map((i) => ({
            name: i.name.length > 14 ? i.name.slice(0, 14) + "…" : i.name,
            value: Math.abs(i.value as number),
          }));

  return {
    ingresos,
    costos,
    gastos,
    activos,
    pasivos,
    patrimonio,
    utilidadBruta,
    utilidadNeta,
    margenBruto,
    margenNeto,
    liquidez,
    endeudamiento,
    equidadRatio,
    capitalTrabajo,
    liquidezCorriente,
    costRatio,
    expenseRatio,
    costDetails: formattedCostDetails,
    expenseDetails: formattedExpenseDetails,
    balanceDetails,
    allEntries,
    otherCount: otherEntries.length,
    ivaGenerado,
    ivaDescontable,
    ivaNeto,
    rentaEstimada,
    ica,
    totalImpuestos,
    impuestoRatio,
    projection,
    savings,
    marginWaterfall,
    documentType: docType,
    chartInsights,
    dashboardChartData,
    quality,
    balanceIndicators,
    pnlIndicators,
    balanceScenarios,
    pnlScenarios,
    indicatorRadar,
    ebitda: c.utilidadOperativa + c.depreciacion,
    utilidadOperativa: c.utilidadOperativa,
  };
}

type Tab = "resumen" | "indicadores" | "proyeccion" | "graficos" | "datos" | "ahorro" | "tributario";

const STATUS_STYLES = {
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  bad: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  neutral: "border-white/10 bg-white/5 text-slate-300",
} as const;

const STATUS_LABEL = { good: "Óptimo", warn: "Atención", bad: "Crítico", neutral: "Info" } as const;

function IndicatorCard({ row }: { row: IndicatorRow }) {
  return (
    <div className={`rounded-xl border p-3 transition hover:border-white/20 ${STATUS_STYLES[row.status]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest opacity-70">{row.group}</div>
          <div className="mt-0.5 text-sm font-semibold text-slate-100">{row.name}</div>
        </div>
        <span className="shrink-0 rounded-full border border-current/30 px-2 py-0.5 font-mono text-[9px] uppercase">
          {STATUS_LABEL[row.status]}
        </span>
      </div>
      <div className="mt-2 font-mono text-xl font-bold">{row.display}</div>
      <div className="mt-1 font-mono text-[10px] opacity-60">{row.formula}</div>
      {row.benchmark && (
        <div className="mt-1 text-[10px] opacity-50">Referencia: {row.benchmark}</div>
      )}
      <p className="mt-2 text-xs leading-relaxed opacity-80">{row.insight}</p>
    </div>
  );
}

function IndicatorsPanel({ rows }: { rows: IndicatorRow[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, IndicatorRow[]>();
    rows.forEach((r) => {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    });
    return Array.from(map.entries());
  }, [rows]);

  return (
    <div className="space-y-4">
      {groups.map(([group, items]) => (
        <div key={group}>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neon">{group}</div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((row) => (
              <IndicatorCard key={row.id} row={row} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BalanceScenarioTable({ rows }: { rows: ScenarioRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-xs">
        <thead className="bg-slate-950/80 text-muted-foreground">
          <tr className="border-b border-white/10">
            <th className="px-3 py-2 text-left">Escenario</th>
            <th className="px-3 py-2 text-right">Activos</th>
            <th className="px-3 py-2 text-right">Pasivos</th>
            <th className="px-3 py-2 text-right">Patrimonio</th>
            <th className="px-3 py-2 text-right">Liquidez</th>
            <th className="px-3 py-2 text-right">Endeud.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.scenario} className="border-b border-white/5 hover:bg-white/[0.02]">
              <td className="px-3 py-2">
                <div className="font-medium text-slate-200">{r.scenario}</div>
                <div className="text-[10px] text-muted-foreground">{r.description}</div>
              </td>
              <td className="px-3 py-2 text-right font-mono text-emerald-glow">{fmtCOP(r.activos ?? 0)}</td>
              <td className="px-3 py-2 text-right font-mono text-rose-300">{fmtCOP(r.pasivos ?? 0)}</td>
              <td className="px-3 py-2 text-right font-mono text-amber-300">{fmtCOP(r.patrimonio ?? 0)}</td>
              <td className="px-3 py-2 text-right font-mono">{(r.liquidez ?? 0).toFixed(2)}x</td>
              <td className="px-3 py-2 text-right font-mono">{(r.endeudamiento ?? 0).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PnLScenarioTable({ rows }: { rows: ScenarioRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-xs">
        <thead className="bg-slate-950/80 text-muted-foreground">
          <tr className="border-b border-white/10">
            <th className="px-3 py-2 text-left">Escenario</th>
            <th className="px-3 py-2 text-right">Ingresos</th>
            <th className="px-3 py-2 text-right">Utilidad</th>
            <th className="px-3 py-2 text-right">Margen neto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.scenario} className="border-b border-white/5 hover:bg-white/[0.02]">
              <td className="px-3 py-2">
                <div className="font-medium text-slate-200">{r.scenario}</div>
                <div className="text-[10px] text-muted-foreground">{r.description}</div>
              </td>
              <td className="px-3 py-2 text-right font-mono text-emerald-glow">{fmtCOP(r.ingresos ?? 0)}</td>
              <td className={`px-3 py-2 text-right font-mono ${(r.utilidad ?? 0) >= 0 ? "text-neon" : "text-rose-400"}`}>
                {fmtCOP(r.utilidad ?? 0)}
              </td>
              <td className="px-3 py-2 text-right font-mono">{(r.margen ?? 0).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartPanel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-white/10 bg-black/30 p-3 ${className}`}>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neon">{title}</div>
      {subtitle && <p className="mb-2 text-xs text-slate-400">{subtitle}</p>}
      {children}
    </div>
  );
}

function KpiTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 truncate font-mono text-sm font-bold ${color}`}>{value}</div>
    </div>
  );
}

export function ScannerAnalytics({
  totals,
  profile,
  docType,
  meta,
}: {
  totals: Record<string, number>;
  profile: ReportProfile;
  docType?: "balance" | "pnl";
  meta?: { entryCount?: number; source?: string };
}) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [search, setSearch] = useState("");
  const a = useMemo(() => computeAdvancedAnalytics(totals, profile, docType ?? "pnl"), [totals, profile, docType]);

  const topChart = useMemo(
    () => a.allEntries.slice(0, 12).map((e) => ({ name: e.name.length > 22 ? e.name.slice(0, 22) + "…" : e.name, value: Math.abs(e.value), fullName: e.name })),
    [a.allEntries]
  );

  const pieData = useMemo(() => topChart.slice(0, 8), [topChart]);

  const taxBreakdown = a.projection
    .filter((p) => p.valueNum > 0 && !/Total|neto/i.test(p.concept))
    .map((p) => ({ name: p.concept.replace(/\(.*\)/, "").trim().slice(0, 28), value: p.valueNum }));

  const filteredData = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return a.allEntries;
    return a.allEntries.filter((e) => e.name.toLowerCase().includes(q));
  }, [a.allEntries, search]);

  const kpis =
    a.documentType === "balance"
      ? [
          { label: "Activos", value: fmtCOP(a.activos), color: "text-emerald-glow" },
          { label: "Pasivos", value: fmtCOP(a.pasivos), color: "text-rose-400" },
          { label: "Patrimonio", value: fmtCOP(a.patrimonio), color: "text-amber-300" },
          { label: "Cap. trabajo", value: fmtCOP(a.capitalTrabajo), color: "text-neon" },
          { label: "Liq. corriente", value: a.liquidezCorriente ? a.liquidezCorriente.toFixed(2) + "x" : "—", color: "text-neon" },
          { label: "Endeudamiento", value: `${a.endeudamiento.toFixed(1)}%`, color: "text-rose-400" },
          { label: "Partidas", value: String(a.allEntries.length), color: "text-slate-300" },
          { label: "Calidad datos", value: a.quality.label, color: "text-emerald-glow" },
        ]
      : [
          { label: "Ingresos", value: fmtCOP(a.ingresos), color: "text-emerald-glow" },
          { label: "Costos", value: fmtCOP(a.costos), color: "text-rose-400" },
          { label: "Gastos", value: fmtCOP(a.gastos), color: "text-amber-300" },
          { label: "Utilidad neta", value: fmtCOP(a.utilidadNeta), color: a.utilidadNeta >= 0 ? "text-emerald-glow" : "text-destructive" },
          { label: "Margen neto", value: `${a.margenNeto.toFixed(1)}%`, color: "text-neon" },
          { label: "Carga fiscal", value: fmtCOP(a.totalImpuestos), color: "text-yellow-300" },
          { label: "Partidas", value: String(a.allEntries.length), color: "text-slate-300" },
          { label: "Calidad datos", value: a.quality.label, color: "text-emerald-glow" },
        ];

  const tabs: { id: Tab; label: string }[] =
    a.documentType === "balance"
      ? [
          { id: "resumen", label: "Resumen" },
          { id: "indicadores", label: `Indicadores (${a.balanceIndicators.length})` },
          { id: "proyeccion", label: "Proyección" },
          { id: "graficos", label: "Gráficos" },
          { id: "datos", label: `Datos (${a.allEntries.length})` },
          { id: "ahorro", label: "Ahorro fiscal" },
        ]
      : [
          { id: "resumen", label: "Resumen" },
          { id: "indicadores", label: `Gestión (${a.pnlIndicators.length})` },
          { id: "proyeccion", label: "Proyección" },
          { id: "graficos", label: "Gráficos" },
          { id: "datos", label: `Datos (${a.allEntries.length})` },
          { id: "ahorro", label: "Ahorro fiscal" },
          { id: "tributario", label: "Tributario" },
        ];

  if (Object.keys(totals).length === 0) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
        No se extrajeron valores numéricos del documento. Prueba con PDF de texto seleccionable, Excel o una imagen más nítida.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header consola */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[oklch(0.7_0.22_245/0.25)] bg-gradient-to-r from-[oklch(0.7_0.22_245/0.08)] to-[oklch(0.92_0.2_105/0.05)] px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-neon">
              {a.documentType === "balance" ? "Estado de Situación Financiera" : "Estado de Resultados"} · Consola BI
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {a.allEntries.length} partidas · {meta?.source ?? "documento"} · {a.balanceIndicators.length + a.pnlIndicators.length} indicadores calculados
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-mono text-[9px] uppercase text-muted-foreground">Calidad datos</div>
            <div className="font-mono text-sm font-bold text-emerald-glow">{a.quality.score}% · {a.quality.label}</div>
          </div>
          <div className="h-10 w-10 rounded-full border border-white/10 p-1">
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none" stroke="#10b981" strokeWidth="3"
                strokeDasharray={`${a.quality.score} ${100 - a.quality.score}`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-white/10 pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition ${
              tab === t.id
                ? "bg-[oklch(0.7_0.22_245/0.2)] text-neon border border-[oklch(0.7_0.22_245/0.4)]"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* KPI grid — always visible */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpis.map((k) => (
          <KpiTile key={k.label} {...k} />
        ))}
      </div>

      {tab === "resumen" && (
        <div className="space-y-3">
          {a.documentType === "balance" ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <ChartPanel title="▹ Estructura patrimonial" subtitle="Activos, pasivos y patrimonio del documento.">
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={a.dashboardChartData} outerRadius={85}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, Math.max(a.activos, a.pasivos, a.patrimonio) || 1]} tickFormatter={fmt} />
                    <Radar name="Valores" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCOP(v)} />
                  </RadarChart>
                </ResponsiveContainer>
              </ChartPanel>
              {a.balanceDetails.length > 0 && (
                <ChartPanel title="▹ Cuentas de balance detectadas">
                  <div className="max-h-[220px] space-y-1.5 overflow-y-auto">
                    {a.balanceDetails.slice(0, 8).map((item) => (
                      <div key={item.name} className="flex items-center justify-between gap-2 rounded-md bg-slate-950/70 px-2.5 py-1.5">
                        <span className="truncate text-xs text-slate-200">{item.name}</span>
                        <span className="shrink-0 font-mono text-xs text-neon">{fmtCOP(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </ChartPanel>
              )}
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              <ChartPanel title="▹ P&L · Ingresos vs costos vs gastos">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={a.dashboardChartData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} tickFormatter={fmt} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCOP(v)} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {a.dashboardChartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
              {a.marginWaterfall.length > 0 && (
                <ChartPanel title="▹ Cascada de utilidad" subtitle="Del ingreso a la utilidad neta.">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={a.marginWaterfall}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} tickFormatter={fmt} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCOP(Math.abs(v))} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {a.marginWaterfall.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartPanel>
              )}
            </div>
          )}

          <ChartPanel title="▹ Interpretación">
            <div className="space-y-2 text-sm text-slate-300">
              {a.chartInsights.map((line, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                  <p>{line}</p>
                </div>
              ))}
            </div>
          </ChartPanel>

          {(a.costDetails.length > 0 || a.expenseDetails.length > 0) && a.documentType === "pnl" && (
            <div className="grid gap-3 lg:grid-cols-2">
              {a.costDetails.length > 0 && (
                <ChartPanel title="▸ Costos detectados">
                  <div className="space-y-1.5">
                    {a.costDetails.slice(0, 6).map((item) => (
                      <div key={item.name} className="rounded-md bg-slate-950/70 px-2.5 py-1.5">
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="truncate text-slate-200">{item.name}</span>
                          <span className="font-mono text-rose-300">{fmtCOP(item.value)}</span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full bg-rose-500/70" style={{ width: `${Math.min(100, item.pct)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </ChartPanel>
              )}
              {a.expenseDetails.length > 0 && (
                <ChartPanel title="▸ Gastos operativos">
                  <div className="space-y-1.5">
                    {a.expenseDetails.slice(0, 6).map((item) => (
                      <div key={item.name} className="rounded-md bg-slate-950/70 px-2.5 py-1.5">
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="truncate text-slate-200">{item.name}</span>
                          <span className="font-mono text-amber-300">{fmtCOP(item.value)}</span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full bg-amber-500/70" style={{ width: `${Math.min(100, item.pct)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </ChartPanel>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "indicadores" && (
        <div className="space-y-4">
          {a.documentType === "balance" ? (
            <>
              <ChartPanel title="◈ Panel de indicadores financieros" subtitle="Liquidez, endeudamiento, rentabilidad y validación contable calculados desde el documento escaneado.">
                <IndicatorsPanel rows={a.balanceIndicators} />
              </ChartPanel>
              {a.indicatorRadar.length > 0 && (
                <ChartPanel title="◈ Radar de salud financiera" subtitle="Visualización comparativa de indicadores clave.">
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={a.indicatorRadar} outerRadius={100}>
                      <PolarGrid stroke="rgba(255,255,255,0.08)" />
                      <PolarAngleAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 9 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                      <Radar name="Indicador" dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} />
                      <Tooltip contentStyle={tooltipStyle} />
                    </RadarChart>
                  </ResponsiveContainer>
                </ChartPanel>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <KpiTile label="Utilidad operativa" value={fmtCOP(a.utilidadOperativa)} color={a.utilidadOperativa >= 0 ? "text-emerald-glow" : "text-rose-400"} />
                <KpiTile label="EBITDA estimado" value={fmtCOP(a.ebitda)} color="text-neon" />
                <KpiTile label="Margen bruto" value={`${a.margenBruto.toFixed(1)}%`} color="text-emerald-glow" />
                <KpiTile label="Margen operativo" value={`${(a.pnlIndicators.find(i => i.id === "margen-op")?.value as number ?? 0).toFixed(1)}%`} color="text-neon" />
              </div>
              <ChartPanel title="◈ Indicadores de gestión y rentabilidad" subtitle="Márgenes, eficiencia operativa, punto de equilibrio y cobertura financiera.">
                <IndicatorsPanel rows={a.pnlIndicators} />
              </ChartPanel>
              {a.indicatorRadar.length > 0 && (
                <ChartPanel title="◈ Perfil de márgenes (%)" className="lg:col-span-2">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={a.indicatorRadar}>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 9 }} unit="%" />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(1)}%`} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {a.indicatorRadar.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartPanel>
              )}
            </>
          )}
        </div>
      )}

      {tab === "proyeccion" && (
        <div className="space-y-3">
          <ChartPanel
            title={a.documentType === "balance" ? "◈ Escenarios de proyección patrimonial" : "◈ Escenarios de proyección de resultados"}
            subtitle="Análisis base, estrés, optimista y extrapolación a partir de los datos escaneados. Referencia para planificación."
          >
            {a.documentType === "balance" ? (
              <BalanceScenarioTable rows={a.balanceScenarios} />
            ) : (
              <PnLScenarioTable rows={a.pnlScenarios} />
            )}
          </ChartPanel>
          <ChartPanel title="◈ Gráfico comparativo de escenarios">
            <ResponsiveContainer width="100%" height={280}>
              {a.documentType === "balance" ? (
                <BarChart data={a.balanceScenarios.map((s) => ({ name: s.scenario.split(" ")[0], activos: s.activos, pasivos: s.pasivos, patrimonio: s.patrimonio }))}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 9 }} tickFormatter={fmt} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCOP(v)} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="activos" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="pasivos" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="patrimonio" fill="#a855f7" radius={[3, 3, 0, 0]} />
                </BarChart>
              ) : (
                <BarChart data={a.pnlScenarios.map((s) => ({ name: s.scenario.split(" ")[0], ingresos: s.ingresos, utilidad: s.utilidad }))}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 9 }} tickFormatter={fmt} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCOP(v)} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="ingresos" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="utilidad" fill="#2563eb" radius={[3, 3, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </ChartPanel>
        </div>
      )}

      {tab === "graficos" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <ChartPanel title="▣ Top conceptos por valor" subtitle={`${topChart.length} de ${a.allEntries.length} partidas más relevantes.`} className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 9 }} tickFormatter={fmt} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fontSize: 9 }} width={110} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => fmtCOP(v)}
                  labelFormatter={(_, payload) => (payload?.[0]?.payload as { fullName?: string })?.fullName ?? ""}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {topChart.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="◐ Composición relativa">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={85}
                  innerRadius={40}
                  paddingAngle={2}
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCOP(v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartPanel>

          {a.documentType === "pnl" && a.ingresos > 0 && (
            <ChartPanel title="◧ Estructura de márgenes (%)" subtitle="Participación de costos y gastos sobre ingresos.">
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart
                  data={[
                    { name: "Margen bruto", pct: a.margenBruto },
                    { name: "Costos/Ing.", pct: a.costRatio },
                    { name: "Gastos/Ing.", pct: a.expenseRatio },
                    { name: "Margen neto", pct: a.margenNeto },
                    { name: "Impuestos/Ing.", pct: a.impuestoRatio },
                  ]}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 9 }} unit="%" domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Bar dataKey="pct" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartPanel>
          )}

          {a.documentType === "balance" && a.balanceIndicators.length > 0 && (
            <ChartPanel title="◧ Indicadores clave (%)" subtitle="Endeudamiento, autonomía y rentabilidad sobre activos/patrimonio.">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={a.balanceIndicators
                    .filter((i) => i.display.includes("%") && i.id !== "cuadre")
                    .map((i) => ({ name: i.name.split(" ")[0], pct: i.value as number }))}
                >
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 9 }} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Bar dataKey="pct" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          )}
        </div>
      )}

      {tab === "datos" && (
        <ChartPanel title="▤ Todas las partidas extraídas" subtitle="Datos completos del archivo escaneado. Usa el buscador para filtrar.">
          <input
            type="search"
            placeholder="Buscar concepto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-neon mb-3 text-sm"
          />
          <div className="max-h-[400px] overflow-auto rounded-md border border-white/10">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-950/95 text-muted-foreground">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Concepto</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-right">% del total</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, i) => (
                  <tr key={row.name + i} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-1.5 text-slate-200">{row.name}</td>
                    <td className={`px-3 py-1.5 text-right font-mono ${row.value < 0 ? "text-rose-400" : "text-neon"}`}>
                      {fmtCOP(row.value)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{row.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredData.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">Sin coincidencias.</p>
            )}
          </div>
        </ChartPanel>
      )}

      {tab === "ahorro" && (
        <TaxSavingsPanel totals={totals} profile={profile} docType={a.documentType} compact />
      )}

      {tab === "tributario" && (
        <div className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <ChartPanel title="⚖ Carga tributaria estimada">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={taxBreakdown} layout="vertical">
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 9 }} tickFormatter={fmt} />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fontSize: 9 }} width={100} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCOP(v)} />
                  <Bar dataKey="value" fill="#eab308" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            {a.savings.length > 0 && (
              <ChartPanel title="✦ Oportunidades de ahorro">
                <div className="space-y-2">
                  {a.savings.map((s, i) => (
                    <div key={s.name} className="rounded-md bg-slate-950/70 px-3 py-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-200">{s.name}</span>
                        <span className="font-mono text-emerald-glow">{fmtCOP(s.value)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (s.value / a.savings[0].value) * 100)}%`,
                            backgroundColor: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </ChartPanel>
            )}
          </div>

          <ChartPanel title="▤ Proyección tributaria detallada">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-white/10">
                    <th className="py-1.5 text-left">Concepto</th>
                    <th className="py-1.5 text-right">Base</th>
                    <th className="py-1.5 text-right">Tarifa</th>
                    <th className="py-1.5 text-right">Estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {a.projection.map((p) => (
                    <tr key={p.concept} className="border-b border-white/5">
                      <td className="py-1.5">{p.concept}</td>
                      <td className="py-1.5 text-right font-mono text-muted-foreground">{p.base}</td>
                      <td className="py-1.5 text-right font-mono">{p.rate}</td>
                      <td className="py-1.5 text-right font-mono text-yellow-300">{p.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartPanel>
        </div>
      )}
    </div>
  );
}

// Wrapper que conecta ScannerAnalytics con el contexto global `useFinance`.
export function ScannerAnalyticsFromContext({ profile, docType }: { profile: ReportProfile; docType?: "balance" | "pnl" }) {
  const { datos } = useFinance();

  // Mapear `datos` a un objeto `totals` que `computeAdvancedAnalytics` pueda consumir.
  const totals: Record<string, number> = {
    ingresos: datos.ingresos || 0,
    costos: datos.costos || 0,
    gastos: datos.gastos || 0,
    activos: datos.activos || 0,
    pasivos: datos.pasivos || 0,
    patrimonio: datos.patrimonio || 0,
    activosCorrientes: datos.activosCorrientes || 0,
    pasivosCorrientes: datos.pasivosCorrientes || 0,
  };

  return <ScannerAnalytics totals={totals} profile={profile} docType={docType} meta={{ source: "contexto" }} />;
}

export function CalculatorAnalytics({
  records,
}: {
  records: Array<{ category: string; amount: number; kind: "income" | "expense"; recorded_at: string }>;
}) {
  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const r of records) {
      if (r.kind === "income") income += Number(r.amount);
      else expense += Number(r.amount);
    }
    const balance = income - expense;
    const margin = income > 0 ? ((income - expense) / income) * 100 : 0;
    return { income, expense, balance, margin, count: records.length };
  }, [records]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; ingresos: number; egresos: number }>();
    records.forEach((r) => {
      const cur = map.get(r.category) ?? { name: r.category, ingresos: 0, egresos: 0 };
      if (r.kind === "income") cur.ingresos += Number(r.amount);
      else cur.egresos += Number(r.amount);
      map.set(r.category, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.ingresos + b.egresos - a.ingresos - a.egresos);
  }, [records]);

  const byDay = useMemo(() => {
    const map = new Map<string, { day: string; ingresos: number; egresos: number; saldo: number }>();
    let saldo = 0;
    [...records]
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
      .forEach((r) => {
        const d = new Date(r.recorded_at).toISOString().slice(5, 10);
        const cur = map.get(d) ?? { day: d, ingresos: 0, egresos: 0, saldo: 0 };
        if (r.kind === "income") {
          cur.ingresos += Number(r.amount);
          saldo += Number(r.amount);
        } else {
          cur.egresos += Number(r.amount);
          saldo -= Number(r.amount);
        }
        cur.saldo = saldo;
        map.set(d, cur);
      });
    return Array.from(map.values()).slice(-60);
  }, [records]);

  const byMonth = useMemo(() => {
    const map = new Map<string, { mes: string; ingresos: number; egresos: number }>();
    records.forEach((r) => {
      const d = new Date(r.recorded_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = map.get(key) ?? { mes: key, ingresos: 0, egresos: 0 };
      if (r.kind === "income") cur.ingresos += Number(r.amount);
      else cur.egresos += Number(r.amount);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-12);
  }, [records]);

  const pieIncomeExpense = useMemo(
    () => [
      { name: "Ingresos", value: summary.income },
      { name: "Egresos", value: summary.expense },
    ],
    [summary]
  );

  const topCategories = byCategory.slice(0, 10);

  if (records.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiTile label="Ingresos" value={fmtCOP(summary.income)} color="text-emerald-glow" />
        <KpiTile label="Egresos" value={fmtCOP(summary.expense)} color="text-rose-400" />
        <KpiTile label="Balance" value={fmtCOP(summary.balance)} color={summary.balance >= 0 ? "text-emerald-glow" : "text-destructive"} />
        <KpiTile label="Movimientos" value={String(summary.count)} color="text-neon" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartPanel title="▲ Flujo diario · Ingresos · Egresos · Saldo" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={byDay}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 9 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 9 }} tickFormatter={fmt} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCOP(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="ingresos" fill="#10b981" fillOpacity={0.15} stroke="#10b981" strokeWidth={2} />
              <Area type="monotone" dataKey="egresos" fill="#ef4444" fillOpacity={0.1} stroke="#ef4444" strokeWidth={2} />
              <Line type="monotone" dataKey="saldo" stroke="#eab308" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="▣ Ingresos vs egresos por categoría">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topCategories}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 8 }} interval={0} angle={-30} textAnchor="end" height={70} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 9 }} tickFormatter={fmt} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCOP(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ingresos" fill="#10b981" radius={[3, 3, 0, 0]} stackId="a" />
              <Bar dataKey="egresos" fill="#ef4444" radius={[3, 3, 0, 0]} stackId="b" />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="◐ Composición global">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieIncomeExpense} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                <Cell fill="#10b981" />
                <Cell fill="#ef4444" />
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCOP(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        {byMonth.length > 1 && (
          <ChartPanel title="▲ Tendencia mensual" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={byMonth}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="mes" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} tickFormatter={fmt} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCOP(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="egresos" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>
        )}
      </div>
    </div>
  );
}
