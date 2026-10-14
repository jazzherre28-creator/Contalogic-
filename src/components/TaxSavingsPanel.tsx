import type { ReportProfile } from "@/lib/pdf-report";
import { computeTaxSavings, GENERAL_TAX_TIPS } from "@/lib/tax-savings";
import { useMemo } from "react";
import { Sparkles, TrendingDown, BookOpen, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

const fmtCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const PRIORITY_STYLE = {
  alta: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  media: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  baja: "border-white/15 bg-white/5 text-slate-300",
} as const;

export function TaxSavingsPanel({
  totals = {},
  profile = {},
  docType = "pnl",
  compact = false,
}: {
  totals?: Record<string, number>;
  profile?: ReportProfile;
  docType?: "balance" | "pnl";
  compact?: boolean;
}) {
  const tips = useMemo(() => computeTaxSavings(totals, profile, docType), [totals, profile, docType]);
  const totalSaving = tips.reduce((s, t) => s + t.potentialSaving, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-transparent px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 p-2.5 text-emerald-glow">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-glow">
              Oportunidades a validar
            </div>
            <div className="text-xl font-bold text-slate-100">
              {totalSaving > 0 ? fmtCOP(totalSaving) : "No cuantificable con solo estados financieros"}
            </div>
          </div>
        </div>
        {!compact && (
          <Link
            to="/scanner"
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-glow transition hover:bg-emerald-500/20"
          >
            Escanear documento <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="space-y-3">
        {tips.map((tip) => (
          <div
            key={tip.id}
            className={`rounded-xl border p-4 ${PRIORITY_STYLE[tip.priority]}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  <h4 className="text-sm font-semibold text-slate-100">{tip.title}</h4>
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-wider opacity-70">
                  {tip.article} · Prioridad {tip.priority}
                </div>
              </div>
              {tip.potentialSaving > 0 && (
                <div className="font-mono text-sm font-bold text-emerald-glow">
                  {fmtCOP(tip.potentialSaving)}
                </div>
              )}
            </div>
            <p className="mt-2 text-sm leading-relaxed opacity-90">{tip.description}</p>
            <div className="mt-3 rounded-lg bg-black/25 px-3 py-2 text-xs leading-relaxed">
              <span className="font-semibold text-neon">Acción: </span>
              {tip.action}
            </div>
          </div>
        ))}
      </div>

      {!compact && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-neon">
            <BookOpen className="h-3.5 w-3.5" />
            Buenas prácticas tributarias
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {GENERAL_TAX_TIPS.map((t) => (
              <div key={t.title} className="rounded-lg bg-slate-950/60 p-3">
                <div className="text-sm font-semibold text-slate-200">{t.title}</div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
