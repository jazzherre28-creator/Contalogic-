import { useState } from "react";
import {
  CATEGORIES,
  SECTOR_LABEL,
  ENTITY_LABEL,
  type SectorKey,
  type EntityType,
} from "@/lib/sectors";
import {
  X,
  Eye,
  Calculator,
  ScanLine,
  Sparkles,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Briefcase,
  Truck,
  ShoppingCart,
  Factory,
} from "lucide-react";

type Props = { open: boolean; onClose: () => void };

const SECTOR_ICON: Record<SectorKey, typeof Truck> = {
  transporte: Truck,
  comercio: ShoppingCart,
  servicios: Briefcase,
  manufactura: Factory,
};

const SECTOR_DESC: Record<SectorKey, string> = {
  transporte:
    "Optimizada para empresas de carga y logística. Categorías: fletes, ACPM, peajes, mantenimiento. Sugiere deducción especial por combustible (Art. 107 ET).",
  comercio:
    "Diseñada para retail y mayoristas. Categorías: ventas, mercancía, arriendo de local, publicidad. Calcula margen bruto y rotación.",
  servicios:
    "Ideal para profesionales y consultorías. Categorías: honorarios, asesorías, software, personal. Aplica retención del 4% (Art. 392 ET).",
  manufactura:
    "Pensada para producción industrial. Categorías: materia prima, mano de obra, energía, exportación. Beneficio de zona franca y CERT.",
};

export function TerminalPreview({ open, onClose }: Props) {
  const [sector, setSector] = useState<SectorKey>("servicios");
  const [entity, setEntity] = useState<EntityType>("juridica");

  if (!open) return null;

  const cats = CATEGORIES[sector];
  const incomes = cats.filter((c) => c.kind === "income");
  const expenses = cats.filter((c) => c.kind === "expense");
  const SectorIcon = SECTOR_ICON[sector];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="glass-neon scanline relative max-h-[92vh] w-full max-w-5xl overflow-y-auto p-5 sm:p-7">
        {/* close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-2 text-muted-foreground hover:bg-white/5 hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--gradient-emerald)] shadow-[var(--shadow-emerald)]">
            <Eye className="h-5 w-5 text-[oklch(0.12_0.02_260)]" />
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-glow">
              Super Ojito · Vista Multi-Terminal
            </div>
            <h2 className="text-xl font-bold sm:text-2xl">
              Previsualiza cualquier <span className="text-neon">terminal</span>
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Mira cómo luce la app para cada sector y tipo de persona, sin
              cambiar tu sesión.
            </p>
          </div>
        </div>

        {/* Selectors */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Sector
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SECTOR_LABEL) as SectorKey[]).map((s) => {
                const Ic = SECTOR_ICON[s];
                return (
                  <button
                    key={s}
                    onClick={() => setSector(s)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      sector === s
                        ? "bg-[oklch(0.7_0.22_245/0.15)] text-neon shadow-[inset_0_0_0_1px_oklch(0.7_0.22_245/0.5)]"
                        : "text-muted-foreground hover:bg-white/5"
                    }`}
                  >
                    <Ic className="h-3.5 w-3.5" />
                    {SECTOR_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Tipo de persona
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(ENTITY_LABEL) as EntityType[]).map((e) => (
                <button
                  key={e}
                  onClick={() => setEntity(e)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    entity === e
                      ? "bg-[oklch(0.92_0.2_105/0.18)] text-emerald-glow shadow-[inset_0_0_0_1px_oklch(0.92_0.2_105/0.55)]"
                      : "text-muted-foreground hover:bg-white/5"
                  }`}
                >
                  {ENTITY_LABEL[e]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sector Description */}
        <div className="mt-4 rounded-lg border border-[oklch(0.7_0.22_245/0.25)] bg-[oklch(0.7_0.22_245/0.06)] p-3">
          <div className="flex items-start gap-2.5">
            <SectorIcon className="mt-0.5 h-4 w-4 shrink-0 text-neon" />
            <p className="text-xs leading-relaxed text-foreground/90">
              <span className="font-semibold text-neon">
                Terminal {SECTOR_LABEL[sector]}:{" "}
              </span>
              {SECTOR_DESC[sector]}
            </p>
          </div>
        </div>

        {/* Mock Terminal Preview */}
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {/* Calculator preview */}
          <div className="glass relative overflow-hidden p-4">
            <div className="mb-2 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-neon" />
              <h3 className="text-sm font-semibold">Calculadora dinámica</h3>
            </div>
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-emerald-glow">
              Ingresos
            </div>
            <div className="flex flex-wrap gap-1.5">
              {incomes.map((c) => (
                <span
                  key={c.key}
                  className="chip !border-[oklch(0.92_0.2_105/0.5)] !text-emerald-glow !bg-[oklch(0.92_0.2_105/0.08)]"
                >
                  <c.icon className="h-3 w-3" />
                  {c.label}
                </span>
              ))}
            </div>
            <div className="mb-3 mt-4 font-mono text-[10px] uppercase tracking-widest text-neon">
              Egresos
            </div>
            <div className="flex flex-wrap gap-1.5">
              {expenses.map((c) => (
                <span key={c.key} className="chip chip-neon">
                  <c.icon className="h-3 w-3" />
                  {c.label}
                </span>
              ))}
            </div>
          </div>

          {/* Mock metrics */}
          <div className="glass relative overflow-hidden p-4">
            <div className="mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-glow" />
              <h3 className="text-sm font-semibold">Dashboard demo</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MockStat
                icon={ArrowUpRight}
                label="Ingresos mes"
                value="$ 18.500.000"
                tone="emerald"
              />
              <MockStat
                icon={ArrowDownRight}
                label="Egresos mes"
                value="$ 12.300.000"
                tone="neon"
              />
              <MockStat
                icon={ScanLine}
                label="Docs OCR"
                value="14"
                tone="neon"
              />
              <MockStat
                icon={Sparkles}
                label="LEX AI"
                value={entity === "juridica" ? "Art. 107" : "RST"}
                tone="emerald"
              />
            </div>
            <div className="mt-3 rounded-md border border-white/10 bg-black/30 p-2.5 font-mono text-[10px] text-muted-foreground">
              <span className="text-emerald-glow">▸</span> Recomendación LEX AI:{" "}
              {entity === "juridica"
                ? "Documenta proporcionalidad y necesidad para deducir gastos (Art. 107 ET)."
                : "Verifica si te conviene el Régimen Simple de Tributación (RST) este año."}
            </div>
          </div>
        </div>

        {/* Modules availability */}
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <ModuleBadge
            icon={Calculator}
            title="Calculadora"
            desc={`${cats.length} categorías ${SECTOR_LABEL[sector]}`}
          />
          <ModuleBadge
            icon={ScanLine}
            title="Escáner OCR"
            desc="Balance · P&L · Facturas"
          />
          <ModuleBadge
            icon={FileText}
            title="LEX AI"
            desc={
              entity === "juridica"
                ? "Régimen ordinario · Art. 107"
                : "RST · Deducciones personales"
            }
          />
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="btn-emerald">
            Cerrar vista previa
          </button>
        </div>
      </div>
    </div>
  );
}

function MockStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone: "neon" | "emerald";
}) {
  return (
    <div className="rounded-md border border-white/5 bg-black/30 p-2.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <Icon
          className={`h-3.5 w-3.5 ${tone === "emerald" ? "text-emerald-glow" : "text-neon"}`}
        />
      </div>
      <div
        className={`mt-1 text-sm font-bold ${tone === "emerald" ? "text-emerald-glow" : "text-neon"}`}
      >
        {value}
      </div>
    </div>
  );
}

function ModuleBadge({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Calculator;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-white/5 bg-black/20 p-2.5">
      <div className="grid h-8 w-8 place-items-center rounded-md bg-[oklch(0.7_0.22_245/0.12)] text-neon">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold">{title}</div>
        <div className="truncate text-[10px] text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}
