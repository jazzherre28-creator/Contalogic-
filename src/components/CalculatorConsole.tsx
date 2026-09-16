import { useMemo, useState, useEffect } from "react";
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
  ComposedChart,
  Area,
  ReferenceLine,
  LabelList,
} from "recharts";
import {
  type FinanceRecord,
  mergeFinanceRecords,
  computeCashFlowMetrics,
  buildCashFlowSeries,
  buildCashWaterfall,
} from "@/lib/unified-finance";
import { classifyTotals } from "@/lib/financial-analytics";
import { useFinance } from "@/lib/finance-context";

const COLORS = ["#2563eb", "#10b981", "#eab308", "#ef4444", "#a855f7"];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const fmtCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const tooltipStyle = { background: "#0a0a14", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8 };

type DataMode = "combined" | "manual" | "ocr";

function KpiTile({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-sm font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
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
    <div className={`rounded-xl border border-white/10 bg-black/30 p-3 ${className}`}>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-neon">{title}</div>
      {subtitle && <p className="mb-2 text-xs text-slate-400">{subtitle}</p>}
      {children}
    </div>
  );
}

export function CalculatorConsole({
  manualRecords,
  ocrRecords,
  ocrTotals,
  ocrDocLabel,
}: {
  manualRecords: FinanceRecord[];
  ocrRecords: FinanceRecord[];
  ocrTotals?: Record<string, number>;
  ocrDocLabel?: string;
}) {
  const { datos } = useFinance();
  const { ultimoCambio } = useFinance();

  // Preferir modo combinado si el contexto global contiene datos OCR significativos
  const contextHasOcrData = (datos.ingresos ?? 0) > 0 || (datos.activos ?? 0) > 0 || (datos.costos ?? 0) > 0;
  const [mode, setMode] = useState<DataMode>(contextHasOcrData || ocrRecords.length > 0 ? "combined" : "manual");
  const [granularity, setGranularity] = useState<"day" | "week" | "month">("day");

  useEffect(() => {
    if (ultimoCambio?.tipo === "limpieza") {
      // Forzar modo manual tras limpieza global
      setMode("manual");
      setGranularity("day");
    }
  }, [ultimoCambio]);

  const records = useMemo(
    () => mergeFinanceRecords(manualRecords, ocrRecords, mode),
    [manualRecords, ocrRecords, mode]
  );

  const metrics = useMemo(() => computeCashFlowMetrics(records), [records]);
  const series = useMemo(() => buildCashFlowSeries(records, granularity), [records, granularity]);
  const waterfall = useMemo(() => buildCashWaterfall(metrics), [metrics]);

  const ocrSummary = useMemo(() => {
    // Preferir totales desde el estado global si existen
    const effectiveTotals: Record<string, number> = {};
    if (datos && ((datos.ingresos ?? 0) > 0 || (datos.activos ?? 0) > 0 || (datos.costos ?? 0) > 0)) {
      effectiveTotals.ingresos = datos.ingresos ?? 0;
      effectiveTotals.costos = datos.costos ?? 0;
      effectiveTotals.gastos = datos.gastos ?? 0;
      effectiveTotals.activos = datos.activos ?? 0;
      effectiveTotals.pasivos = datos.pasivos ?? 0;
      effectiveTotals.patrimonio = datos.patrimonio ?? 0;
    } else if (ocrTotals && Object.keys(ocrTotals).length > 0) {
      Object.assign(effectiveTotals, ocrTotals);
    } else {
      return null;
    }

    return classifyTotals(effectiveTotals);
  }, [ocrTotals, datos]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; ingresos: number; egresos: number }>();
    records.forEach((r) => {
      const cur = map.get(r.category) ?? { name: r.category, ingresos: 0, egresos: 0 };
      if (r.kind === "income") cur.ingresos += r.amount;
      else cur.egresos += r.amount;
      map.set(r.category, cur);
    });
    return Array.from(map.values())
      .sort((a, b) => b.ingresos + b.egresos - a.ingresos - a.egresos)
      .slice(0, 10);
  }, [records]);

  const sourceCounts = useMemo(() => {
    let manual = 0;
    let ocr = 0;
    records.forEach((r) => (r.source === "ocr" ? ocr++ : manual++));
    return { manual, ocr, total: records.length };
  }, [records]);

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
        <p className="text-sm text-amber-100">
          Registra movimientos en la calculadora o escanea un Balance/P&L en el{" "}
          <span className="text-neon">Escáner OCR</span> para ver flujo de caja y gráficos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + fuentes */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[oklch(0.7_0.22_245/0.25)] bg-gradient-to-r from-[oklch(0.7_0.22_245/0.08)] to-transparent px-4 py-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-neon">Consola · Flujo de caja</div>
          <div className="text-xs text-muted-foreground">
            {sourceCounts.total} partidas · {sourceCounts.manual} manual · {sourceCounts.ocr} OCR
            {ocrDocLabel && ` · ${ocrDocLabel}`}
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {(["combined", "manual", "ocr"] as const).map((m) => {
            if (m === "ocr" && ocrRecords.length === 0) return null;
            const labels = { combined: "Combinado", manual: "Calculadora", ocr: "Solo OCR" };
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                  mode === m
                    ? "bg-neon/20 text-neon border border-neon/40"
                    : "border border-white/10 text-muted-foreground hover:text-foreground"
                }`}
              >
                {labels[m]}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPIs flujo de caja */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <KpiTile label="Ingresos" value={fmtCOP(metrics.totalIngresos)} color="text-emerald-glow" />
        <KpiTile label="Egresos" value={fmtCOP(metrics.totalEgresos)} color="text-rose-400" />
        <KpiTile
          label="Flujo neto"
          value={fmtCOP(metrics.flujoNeto)}
          color={metrics.flujoNeto >= 0 ? "text-emerald-glow" : "text-destructive"}
        />
        <KpiTile label="Margen flujo" value={`${metrics.margenFlujo.toFixed(1)}%`} color="text-neon" />
        <KpiTile
          label="Quema mensual est."
          value={fmtCOP(metrics.quemaMensual)}
          color="text-amber-300"
          sub="egreso promedio × 30"
        />
        <KpiTile
          label="Runway"
          value={
            metrics.mesesRunway != null && isFinite(metrics.mesesRunway)
              ? `${metrics.mesesRunway.toFixed(1)} meses`
              : "—"
          }
          color="text-neon"
          sub="con flujo actual"
        />
      </div>

      {ocrSummary && mode !== "manual" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <KpiTile label="OCR · Ingresos" value={fmtCOP(ocrSummary.ingresos)} color="text-emerald-glow" />
          <KpiTile label="OCR · Costos" value={fmtCOP(ocrSummary.costos)} color="text-rose-400" />
          <KpiTile label="OCR · Gastos" value={fmtCOP(ocrSummary.gastos)} color="text-amber-300" />
          <KpiTile
            label="OCR · Utilidad est."
            value={fmtCOP(ocrSummary.utilidadNeta)}
            color={ocrSummary.utilidadNeta >= 0 ? "text-neon" : "text-destructive"}
          />
        </div>
      )}

      <div className="flex gap-1">
        {(["day", "week", "month"] as const).map((g) => (
          <button
            key={g}
            onClick={() => setGranularity(g)}
            className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase ${
              granularity === g ? "bg-white/10 text-neon" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {g === "day" ? "Diario" : g === "week" ? "Semanal" : "Mensual"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Flujo de caja acumulado */}
        <ChartPanel
          title="◈ Flujo de caja acumulado"
          subtitle="Saldo acumulado del flujo neto por período."
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={series}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="period" stroke="#94a3b8" tick={{ fontSize: 9 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 9 }} tickFormatter={fmt} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCOP(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
              <Bar dataKey="ingresos" fill="#10b981" radius={[3, 3, 0, 0]} opacity={0.85} />
              <Bar dataKey="egresos" fill="#ef4444" radius={[3, 3, 0, 0]} opacity={0.85} />
              <Line type="monotone" dataKey="acumulado" stroke="#eab308" strokeWidth={2.5} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="neto" stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Cascada */}
        <ChartPanel title="◈ Cascada de flujo de caja" subtitle="Ingresos → Egresos → Flujo neto total.">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={waterfall}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 9 }} tickFormatter={fmt} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCOP(Math.abs(v))} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {waterfall.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Composición */}
        <ChartPanel title="◐ Distribución ingresos / egresos" subtitle="Diagrama de pastel tipo dona para identificar con claridad la proporción de ingresos y egresos.">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={[
                  { name: "Ingresos", value: Math.max(metrics.totalIngresos, 1) },
                  { name: "Egresos", value: Math.max(metrics.totalEgresos, 1) },
                ]}
                dataKey="value"
                nameKey="name"
                innerRadius={62}
                outerRadius={92}
                paddingAngle={3}
                cornerRadius={6}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                <Cell fill="#10b981" />
                <Cell fill="#ef4444" />
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCOP(v)} />
              <Legend verticalAlign="bottom" height={24} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Por categoría */}
        <ChartPanel title="▣ Por categoría / concepto" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={byCategory} layout="vertical" barCategoryGap="30%" margin={{ left: 16, right: 16, top: 10, bottom: 10 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 10 }} tickFormatter={fmt} />
              <YAxis
                dataKey="name"
                type="category"
                stroke="#94a3b8"
                tick={{ fontSize: 10 }}
                width={160}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCOP(v)} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="ingresos" fill="#10b981" radius={[4, 0, 0, 4]} barSize={16}>
                <LabelList dataKey="ingresos" position="right" formatter={(value: number) => fmtCOP(value)} style={{ fill: "#d9f99d", fontSize: 10 }} />
              </Bar>
              <Bar dataKey="egresos" fill="#ef4444" radius={[4, 0, 0, 4]} barSize={16}>
                <LabelList dataKey="egresos" position="right" formatter={(value: number) => fmtCOP(value)} style={{ fill: "#fecaca", fontSize: 10 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Tendencia neto */}
        {series.length > 1 && (
          <ChartPanel title="▲ Flujo neto por período" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={series}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" stroke="#94a3b8" tick={{ fontSize: 9 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 9 }} tickFormatter={fmt} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCOP(v)} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" />
                <Area
                  type="monotone"
                  dataKey="neto"
                  stroke="#2563eb"
                  fill="#2563eb"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartPanel>
        )}
      </div>
    </div>
  );
}
