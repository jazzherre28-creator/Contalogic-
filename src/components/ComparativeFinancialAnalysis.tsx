import { useState } from "react";
import { classifyTotals } from "@/lib/financial-analytics";

type ComparativeDoc = {
  id: string;
  doc_type: "balance" | "pnl";
  parsed_data: {
    totals?: Record<string, number>;
    comparativeLineItems?: Array<{ label: string; value: number; period?: string }>;
    meta?: {
      periodLabel?: string;
      unitMultiplier?: number;
    };
  } | null;
  file_name: string | null;
  created_at: string;
};

type ReturnMetric = {
  name: string;
  current: number | null;
};

const formatPercent = (value: number | null) =>
  value == null || !Number.isFinite(value) ? "N/D" : `${value.toFixed(2)}%`;

function comparativeTotals(doc: ComparativeDoc): Record<string, number> | null {
  const items = doc.parsed_data?.comparativeLineItems;
  if (!items?.length) return null;
  const multiplier = doc.parsed_data?.meta?.unitMultiplier ?? 1;
  return items.reduce<Record<string, number>>((totals, item) => {
    totals[item.label] = (totals[item.label] ?? 0) + item.value * multiplier;
    return totals;
  }, {});
}

function documentLabel(doc: ComparativeDoc) {
  const period = doc.parsed_data?.meta?.periodLabel;
  const name = doc.file_name ?? "Documento";
  return period
    ? `${period} · ${name}`
    : `${name} · ${new Date(doc.created_at).toLocaleDateString("es-CO")}`;
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

  const closingBalance = classifyTotals(closingDoc.parsed_data?.totals ?? {});
  const comparative = comparativeTotals(closingDoc);
  const openingBalance = openingDoc
    ? classifyTotals(openingDoc.parsed_data?.totals ?? {})
    : comparative
      ? classifyTotals(comparative)
      : null;
  const pnl = pnlDoc ? classifyTotals(pnlDoc.parsed_data?.totals ?? {}) : null;
  const netIncome = pnl?.hasNetIncome ? pnl.utilidadNeta : null;
  const averageAssets = openingBalance
    ? openingBalance.hasTotalAssets && closingBalance.hasTotalAssets
      ? (openingBalance.activos + closingBalance.activos) / 2
      : null
    : closingBalance.hasTotalAssets
      ? closingBalance.activos
      : null;
  const averageEquity = openingBalance
    ? openingBalance.hasEquity && closingBalance.hasEquity
      ? (openingBalance.patrimonio + closingBalance.patrimonio) / 2
      : null
    : closingBalance.hasEquity
      ? closingBalance.patrimonio
      : null;
  const returnMetrics: ReturnMetric[] = [
    {
      name: "ROE",
      current:
        netIncome != null && averageEquity != null && averageEquity > 0
          ? (netIncome / averageEquity) * 100
          : null,
    },
    {
      name: "RAE",
      current:
        netIncome != null && averageAssets != null && averageAssets > 0
          ? (netIncome / averageAssets) * 100
          : null,
    },
  ];

  return (
    <section className="glass space-y-4 p-5">
      <div>
        <h3 className="text-sm font-semibold">Comparativo de rentabilidad</h3>
      </div>

      {balanceDocs.length >= 2 ? (
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
      ) : null}

      {pnlDocs.length > 0 ? (
        <label className="block max-w-2xl space-y-1 text-xs text-muted-foreground">
          Estado de resultados
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
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[300px] text-xs">
          <thead className="bg-slate-950/80 text-muted-foreground">
            <tr className="border-b border-white/10">
              <th className="px-3 py-2 text-left">Indicador</th>
              <th className="px-3 py-2 text-right">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {returnMetrics.map((metric) => (
              <tr key={metric.name} className="border-b border-white/5">
                <td className="px-3 py-2 text-slate-200">{metric.name}</td>
                <td className="px-3 py-2 text-right font-mono text-neon">
                  {formatPercent(metric.current)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
