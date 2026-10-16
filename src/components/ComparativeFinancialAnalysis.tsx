import { useState } from "react";
import { classifyTotals } from "@/lib/financial-analytics";

type ComparativeDoc = {
  id: string;
  doc_type: "balance" | "pnl";
  parsed_data: {
    totals?: Record<string, number>;
    meta?: {
      periodLabel?: string;
    };
  } | null;
  file_name: string | null;
  created_at: string;
};

type Metric = {
  name: string;
  previous: number | null;
  current: number | null;
  unit: "currency" | "ratio" | "percent";
};

const formatCurrency = (value: number | null) =>
  value == null
    ? "N/D"
    : new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(value);

const formatMetric = (value: number | null, unit: Metric["unit"]) => {
  if (value == null || !Number.isFinite(value)) return "N/D";
  if (unit === "currency") return formatCurrency(value);
  return unit === "ratio" ? `${value.toFixed(2)}x` : `${value.toFixed(1)}%`;
};

function documentLabel(doc: ComparativeDoc) {
  const period = doc.parsed_data?.meta?.periodLabel;
  const name = doc.file_name ?? "Documento";
  return period
    ? `${period} · ${name}`
    : `${name} · ${new Date(doc.created_at).toLocaleDateString("es-CO")}`;
}

function balanceMetrics(
  previousTotals: Record<string, number>,
  currentTotals: Record<string, number>,
) {
  const previous = classifyTotals(previousTotals);
  const current = classifyTotals(currentTotals);
  const previousWorkingCapital =
    previous.hasCurrentAssets && previous.hasCurrentLiabilities
      ? previous.activosCorrientes - previous.pasivosCorrientes
      : null;
  const currentWorkingCapital =
    current.hasCurrentAssets && current.hasCurrentLiabilities
      ? current.activosCorrientes - current.pasivosCorrientes
      : null;

  const metric = (
    name: string,
    previousValue: number | null,
    currentValue: number | null,
    unit: Metric["unit"],
  ): Metric => ({ name, previous: previousValue, current: currentValue, unit });

  return {
    metrics: [
      metric(
        "Activos totales",
        previous.hasTotalAssets ? previous.activos : null,
        current.hasTotalAssets ? current.activos : null,
        "currency",
      ),
      metric(
        "Activos corrientes",
        previous.hasCurrentAssets ? previous.activosCorrientes : null,
        current.hasCurrentAssets ? current.activosCorrientes : null,
        "currency",
      ),
      metric(
        "Pasivos totales",
        previous.hasTotalLiabilities ? previous.pasivos : null,
        current.hasTotalLiabilities ? current.pasivos : null,
        "currency",
      ),
      metric(
        "Pasivos corrientes",
        previous.hasCurrentLiabilities ? previous.pasivosCorrientes : null,
        current.hasCurrentLiabilities ? current.pasivosCorrientes : null,
        "currency",
      ),
      metric(
        "Patrimonio",
        previous.hasEquity ? previous.patrimonio : null,
        current.hasEquity ? current.patrimonio : null,
        "currency",
      ),
      metric("Capital de trabajo", previousWorkingCapital, currentWorkingCapital, "currency"),
      metric(
        "Razón corriente",
        previous.hasCurrentAssets &&
          previous.hasCurrentLiabilities &&
          previous.pasivosCorrientes > 0
          ? previous.activosCorrientes / previous.pasivosCorrientes
          : null,
        current.hasCurrentAssets && current.hasCurrentLiabilities && current.pasivosCorrientes > 0
          ? current.activosCorrientes / current.pasivosCorrientes
          : null,
        "ratio",
      ),
      metric(
        "Solvencia (activos / pasivos)",
        previous.hasTotalAssets && previous.hasTotalLiabilities && previous.pasivos > 0
          ? previous.activos / previous.pasivos
          : null,
        current.hasTotalAssets && current.hasTotalLiabilities && current.pasivos > 0
          ? current.activos / current.pasivos
          : null,
        "ratio",
      ),
      metric(
        "Endeudamiento",
        previous.hasTotalAssets && previous.activos > 0
          ? (previous.pasivos / previous.activos) * 100
          : null,
        current.hasTotalAssets && current.activos > 0
          ? (current.pasivos / current.activos) * 100
          : null,
        "percent",
      ),
      metric(
        "Autonomía financiera",
        previous.hasEquity && previous.hasTotalAssets && previous.activos > 0
          ? (previous.patrimonio / previous.activos) * 100
          : null,
        current.hasEquity && current.hasTotalAssets && current.activos > 0
          ? (current.patrimonio / current.activos) * 100
          : null,
        "percent",
      ),
    ],
    previous,
    current,
  };
}

function variation(metric: Metric) {
  const { previous, current, unit } = metric;
  if (previous == null || current == null) return "N/D";
  if (unit === "currency") {
    if (previous === 0) return current === 0 ? "0.0%" : "N/D";
    const change = ((current - previous) / Math.abs(previous)) * 100;
    return `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
  }
  const change = current - previous;
  const suffix = unit === "ratio" ? "x" : " pp";
  return `${change > 0 ? "+" : ""}${change.toFixed(2)}${suffix}`;
}

export function ComparativeFinancialAnalysis({ docs }: { docs: ComparativeDoc[] }) {
  const balanceDocs = docs.filter((doc) => doc.doc_type === "balance");
  const pnlDocs = docs.filter((doc) => doc.doc_type === "pnl");
  const [closingId, setClosingId] = useState("");
  const [openingId, setOpeningId] = useState("");
  const [pnlId, setPnlId] = useState("");

  if (balanceDocs.length === 0) return null;

  const closingDoc = balanceDocs.find((doc) => doc.id === closingId) ?? balanceDocs[0];
  const openingDoc =
    balanceDocs.find((doc) => doc.id === openingId && doc.id !== closingDoc.id) ??
    balanceDocs.find((doc) => doc.id !== closingDoc.id);
  const pnlDoc = pnlDocs.find((doc) => doc.id === pnlId) ?? pnlDocs[0];

  const analysis = openingDoc
    ? balanceMetrics(openingDoc.parsed_data?.totals ?? {}, closingDoc.parsed_data?.totals ?? {})
    : null;
  const pnl = pnlDoc ? classifyTotals(pnlDoc.parsed_data?.totals ?? {}) : null;
  const averageAssets =
    analysis?.previous.hasTotalAssets && analysis.current.hasTotalAssets
      ? (analysis.previous.activos + analysis.current.activos) / 2
      : null;
  const averageEquity =
    analysis?.previous.hasEquity && analysis.current.hasEquity
      ? (analysis.previous.patrimonio + analysis.current.patrimonio) / 2
      : null;
  const netIncome = pnl?.hasNetIncome ? pnl.utilidadNeta : null;
  const returnMetrics: Metric[] = [
    {
      name: "ROA · utilidad neta / activos promedio",
      previous: null,
      current:
        netIncome != null && averageAssets != null && averageAssets > 0
          ? (netIncome / averageAssets) * 100
          : null,
      unit: "percent",
    },
    {
      name: "ROE · utilidad neta / patrimonio promedio",
      previous: null,
      current:
        netIncome != null && averageEquity != null && averageEquity > 0
          ? (netIncome / averageEquity) * 100
          : null,
      unit: "percent",
    },
  ];

  return (
    <section className="glass space-y-4 p-5">
      <div>
        <h3 className="text-sm font-semibold">Comparación financiera entre periodos</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Compara dos estados de situación financiera. Los cambios monetarios son porcentuales; en
          ratios se muestran diferencias en veces o puntos porcentuales.
        </p>
      </div>

      {balanceDocs.length < 2 ? (
        <p className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm text-muted-foreground">
          Carga otro estado de situación financiera para comparar periodos y calcular ROA/ROE con
          saldos promedio.
        </p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              Periodo inicial
              <select
                value={openingDoc?.id ?? ""}
                onChange={(event) => setOpeningId(event.target.value)}
                className="input-neon w-full text-sm"
              >
                {balanceDocs
                  .filter((doc) => doc.id !== closingDoc.id)
                  .map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {documentLabel(doc)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Periodo final
              <select
                value={closingDoc.id}
                onChange={(event) => setClosingId(event.target.value)}
                className="input-neon w-full text-sm"
              >
                {balanceDocs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {documentLabel(doc)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {analysis && (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[620px] text-xs">
                <thead className="bg-slate-950/80 text-muted-foreground">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-left">Indicador</th>
                    <th className="px-3 py-2 text-right">Inicial</th>
                    <th className="px-3 py-2 text-right">Final</th>
                    <th className="px-3 py-2 text-right">Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {[...analysis.metrics, ...returnMetrics].map((metric) => (
                    <tr key={metric.name} className="border-b border-white/5">
                      <td className="px-3 py-2 text-slate-200">{metric.name}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatMetric(metric.previous, metric.unit)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-neon">
                        {formatMetric(metric.current, metric.unit)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-300">
                        {metric.previous == null && metric.current != null
                          ? "Periodo analizado"
                          : variation(metric)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pnlDocs.length > 0 ? (
            <label className="block max-w-2xl space-y-1 text-xs text-muted-foreground">
              Estado de resultados para rentabilidad (opcional)
              <select
                value={pnlDoc?.id ?? ""}
                onChange={(event) => setPnlId(event.target.value)}
                className="input-neon w-full text-sm"
              >
                {pnlDocs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {documentLabel(doc)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100">
              ROA y ROE requieren utilidad neta del estado de resultados, además de ambos balances.
              Carga también el P&amp;L del periodo para calcularlos.
            </p>
          )}

          {pnlDoc && netIncome == null && (
            <p className="text-xs text-amber-100">
              El P&amp;L seleccionado no presenta utilidad neta identificable; ROA y ROE quedan como
              N/D para no estimar el resultado.
            </p>
          )}
          {pnlDoc && netIncome != null && (
            <p className="text-xs text-muted-foreground">
              ROA/ROE usan la utilidad neta explícita del P&amp;L seleccionado y el promedio de los
              saldos inicial y final. Confirma que los tres documentos correspondan al mismo
              ejercicio y unidad monetaria.
            </p>
          )}
        </>
      )}
    </section>
  );
}
