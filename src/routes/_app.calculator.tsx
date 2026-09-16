import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CATEGORIES, SECTOR_LABEL } from "@/lib/sectors";
import { Calculator, Plus, Minus, Trash2, History, FileDown, FileSpreadsheet, BarChart3, ScanLine, Download } from "lucide-react";
import { toast } from "sonner";
import { generateCalculatorReport } from "@/lib/pdf-report";
import { exportCalculatorXLSX } from "@/lib/excel-report";
import { CalculatorConsole } from "@/components/CalculatorConsole";
import { useFinance } from "@/lib/finance-context";
import { ocrParsedToRecords, type FinanceRecord } from "@/lib/unified-finance";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/calculator")({
  component: CalculatorPage,
});

type Rec = {
  id: string;
  amount: number;
  kind: "income" | "expense";
  category: string;
  note: string | null;
  recorded_at: string;
};

function CalculatorPage() {
  const { user, profile } = useAuth();
  const cats = useMemo(
    () => (profile?.sector ? CATEGORIES[profile.sector] : []),
    [profile]
  );
  const [activeKey, setActiveKey] = useState<string>(cats[0]?.key ?? "");
  const [display, setDisplay] = useState("0");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<Rec[]>([]);
  const [allRecords, setAllRecords] = useState<Rec[]>([]);
  const [ocrDocs, setOcrDocs] = useState<
    Array<{
      id: string;
      doc_type: "balance" | "pnl";
      file_name: string | null;
      created_at: string;
      parsed_data: {
        totals?: Record<string, number>;
        lineItems?: Array<{ label: string; value: number }>;
      } | null;
    }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!activeKey && cats[0]) setActiveKey(cats[0].key);
  }, [cats, activeKey]);

  const loadHistory = async () => {
    if (!user) return;
    const [{ data: recent }, { data: all }, { data: ocr }] = await Promise.all([
      supabase
        .from("financial_records")
        .select("*")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: false })
        .limit(15),
      supabase
        .from("financial_records")
        .select("*")
        .eq("user_id", user.id)
        .order("recorded_at", { ascending: true }),
      supabase
        .from("ocr_documents")
        .select("id, doc_type, file_name, created_at, parsed_data")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    setHistory((recent ?? []) as Rec[]);
    setAllRecords((all ?? []) as Rec[]);
    setOcrDocs((ocr ?? []) as typeof ocrDocs);
  };
  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const press = (s: string) => {
    setDisplay((d) => {
      if (s === "C") return "0";
      if (s === "←") return d.length <= 1 ? "0" : d.slice(0, -1);
      if (s === ".") return d.includes(".") ? d : d + ".";
      if (d === "0" && s !== ".") return s;
      return d + s;
    });
  };

  const activeCat = cats.find((c) => c.key === activeKey);

  const save = async () => {
    if (!user || !activeCat) return;
    const amount = Number(display);
    if (!amount || amount <= 0) {
      toast.error("Monto inválido");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("financial_records").insert({
        user_id: user.id,
        category: activeCat.label,
        amount,
        kind: activeCat.kind,
        note: note || null,
      });
      if (error) throw error;
      toast.success(
        `${activeCat.kind === "income" ? "Ingreso" : "Egreso"} registrado · ${activeCat.label}`
      );
      setDisplay("0");
      setNote("");
      loadHistory();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await supabase.from("financial_records").delete().eq("id", id);
    loadHistory();
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(n);

  const manualFinance: FinanceRecord[] = useMemo(
    () =>
      allRecords.map((r) => ({
        category: r.category,
        amount: Number(r.amount),
        kind: r.kind,
        recorded_at: r.recorded_at,
        source: "manual" as const,
        note: r.note,
      })),
    [allRecords]
  );

  const ocrFinance: FinanceRecord[] = useMemo(() => {
    const out: FinanceRecord[] = [];
    for (const doc of ocrDocs) {
      const parsed = doc.parsed_data ?? {};
      if (!parsed.totals && !parsed.lineItems?.length) continue;
      out.push(
        ...ocrParsedToRecords(
          { totals: parsed.totals, lineItems: parsed.lineItems },
          {
            fileName: doc.file_name ?? undefined,
            docType: doc.doc_type,
            scannedAt: doc.created_at,
          }
        )
      );
    }
    return out;
  }, [ocrDocs]);

  const latestOcr = ocrDocs[0];
  const latestOcrTotals = latestOcr?.parsed_data?.totals ?? {};

  const importOcrToCalculator = async () => {
    if (!user || ocrFinance.length === 0) return;
    setImporting(true);
    try {
      const rows = ocrFinance.map((r) => ({
        user_id: user.id,
        category: r.category.replace(/^\[OCR\]\s*/, ""),
        amount: r.amount,
        kind: r.kind,
        note: r.note ?? "Importado desde OCR",
      }));
      const { error } = await supabase.from("financial_records").insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} partidas del escaneo importadas a movimientos`);
      loadHistory();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  const { limpiar } = useFinance();

  const clearUiOnly = () => {
    // Limpiar estado UI: calculadora local y estado OCR mostrado
    setDisplay("0");
    setNote("");
    setHistory([]);
    setAllRecords([]);
    setOcrDocs([]);
    // limpiar contexto global OCR
    try {
      limpiar();
      toast.success("Interfaz limpiada: OCR y calculadora (UI)");
    } catch (e) {
      console.error(e);
      toast.error("Error al limpiar la interfaz");
    }
  };

  const deleteAllFromDb = async () => {
    if (!user) return;
    const ok = window.confirm(
      "Esta acción eliminará TODOS los registros de la calculadora y los documentos OCR del usuario en la base de datos. ¿Deseas continuar?"
    );
    if (!ok) return;
    try {
      // Borrar registros financieros
      await supabase.from("financial_records").delete().eq("user_id", user.id);
      // Borrar documentos OCR (parcialmente destructivo)
      await supabase.from("ocr_documents").delete().eq("user_id", user.id);
      toast.success("Registros y documentos OCR borrados en la base de datos");
      // Recargar y limpiar UI
      loadHistory();
      limpiar();
    } catch (err: unknown) {
      console.error(err);
      toast.error("Error al borrar registros en la base de datos");
    }
  };

  const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ".", "←"];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* Calculator */}
      <div className="glass-neon scanline relative p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-neon" />
            <h2 className="text-sm font-semibold">
              Calculadora · {profile?.sector ? SECTOR_LABEL[profile.sector] : ""}
            </h2>
          </div>
          <span className="chip">{activeCat?.kind === "income" ? "INGRESO" : "EGRESO"}</span>
        </div>

        <div className="mb-4 rounded-lg border border-white/10 bg-black/30 p-4 text-right">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {activeCat?.label ?? "—"}
          </div>
          <div className="font-mono text-3xl font-semibold text-neon sm:text-4xl">
            {fmt(Number(display))}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">{display}</div>
        </div>

        {/* Sector category buttons */}
        <div className="mb-4">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Categorías del sector
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cats.map((c) => {
              const active = activeKey === c.key;
              const income = c.kind === "income";
              return (
                <button
                  key={c.key}
                  onClick={() => setActiveKey(c.key)}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
                    active
                      ? income
                        ? "border-[oklch(0.92_0.2_105/0.6)] bg-[oklch(0.92_0.2_105/0.12)] text-emerald-glow"
                        : "border-[oklch(0.7_0.22_245/0.6)] bg-[oklch(0.7_0.22_245/0.12)] text-neon"
                      : "border-white/10 hover:border-white/25 text-foreground"
                  }`}
                >
                  <c.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{c.label}</span>
                  {income ? (
                    <Plus className="ml-auto h-3 w-3 opacity-60" />
                  ) : (
                    <Minus className="ml-auto h-3 w-3 opacity-60" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-4 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              className="rounded-md border border-white/10 bg-white/5 py-3 text-lg font-semibold transition hover:border-[oklch(0.7_0.22_245/0.5)] hover:text-neon"
            >
              {k}
            </button>
          ))}
          <button
            onClick={() => press("C")}
            className="col-span-2 rounded-md border border-white/10 bg-white/5 py-3 font-semibold transition hover:border-destructive hover:text-destructive"
          >
            Limpiar
          </button>
          <button
            onClick={() => setDisplay((d) => (d.endsWith("000") ? d : d + "000"))}
            className="col-span-2 rounded-md border border-white/10 bg-white/5 py-3 font-semibold transition hover:border-[oklch(0.7_0.22_245/0.5)] hover:text-neon"
          >
            +000
          </button>
        </div>

        <input
          type="text"
          placeholder="Nota (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input-neon mt-3"
        />

        <button onClick={save} disabled={busy} className="btn-emerald mt-3 w-full">
          {busy ? "Guardando…" : `Registrar ${activeCat?.kind === "income" ? "ingreso" : "egreso"}`}
        </button>
      </div>

      {/* History */}
      <div className="glass p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-neon" />
            <h3 className="text-sm font-semibold">Movimientos recientes</h3>
          </div>
          <div className="flex items-center gap-1.5">
          <button
            onClick={async () => {
              if (!user) return;
              const { data } = await supabase
                .from("financial_records")
                .select("*")
                .eq("user_id", user.id)
                .order("recorded_at", { ascending: false });
              const recs = (data ?? []) as Rec[];
              if (recs.length === 0) {
                toast.error("Sin movimientos para reportar");
                return;
              }
              generateCalculatorReport({
                profile: profile ?? {},
                records: recs.map((r) => ({
                  category: r.category,
                  amount: Number(r.amount),
                  kind: r.kind,
                  note: r.note,
                  recorded_at: r.recorded_at,
                })),
              });
              toast.success("Reporte PDF generado");
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-[oklch(0.92_0.2_105/0.5)] bg-[oklch(0.92_0.2_105/0.1)] px-2.5 py-1 text-[11px] font-semibold text-emerald-glow transition hover:bg-[oklch(0.92_0.2_105/0.2)]"
          >
            <FileDown className="h-3 w-3" /> PDF
          </button>
          <button
            onClick={async () => {
              if (!user) return;
              const { data } = await supabase
                .from("financial_records")
                .select("*")
                .eq("user_id", user.id)
                .order("recorded_at", { ascending: false });
              const recs = (data ?? []) as Rec[];
              if (recs.length === 0) {
                toast.error("Sin movimientos para exportar");
                return;
              }
              exportCalculatorXLSX({
                records: recs.map((r) => ({
                  category: r.category,
                  amount: Number(r.amount),
                  kind: r.kind,
                  note: r.note,
                  recorded_at: r.recorded_at,
                })),
              });
              toast.success("Excel generado");
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-[oklch(0.7_0.22_245/0.5)] bg-[oklch(0.7_0.22_245/0.1)] px-2.5 py-1 text-[11px] font-semibold text-neon transition hover:bg-[oklch(0.7_0.22_245/0.2)]"
          >
            <FileSpreadsheet className="h-3 w-3" /> Excel
          </button>
          </div>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos aún.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{r.category}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {new Date(r.recorded_at).toLocaleString("es-CO")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-sm font-semibold ${
                      r.kind === "income" ? "text-emerald-glow" : "text-neon"
                    }`}
                  >
                    {r.kind === "income" ? "+" : "−"}
                    {fmt(Number(r.amount))}
                  </span>
                  <button
                    onClick={() => remove(r.id)}
                    className="text-muted-foreground transition hover:text-destructive"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(allRecords.length > 0 || ocrFinance.length > 0) && (
        <div className="glass p-5 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-glow" />
              <h3 className="text-sm font-semibold">Consola · Flujo de caja y análisis</h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {ocrFinance.length > 0 && (
                <button
                  onClick={importOcrToCalculator}
                  disabled={importing}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-glow transition hover:bg-emerald-500/20 disabled:opacity-60"
                >
                  <Download className="h-3 w-3" />
                  {importing ? "Importando…" : `Importar ${ocrFinance.length} partidas OCR`}
                </button>
              )}
              {ocrDocs.length === 0 && (
                <Link
                  to="/scanner"
                  className="inline-flex items-center gap-1.5 rounded-md border border-neon/40 bg-neon/10 px-2.5 py-1 text-[11px] font-semibold text-neon transition hover:bg-neon/20"
                >
                  <ScanLine className="h-3 w-3" /> Escanear documento
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => clearUiOnly()}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/6 px-2.5 py-1 text-[11px] font-semibold text-amber-400 transition hover:bg-amber-500/12"
            >
              Limpiar UI
            </button>
            <button
              onClick={() => deleteAllFromDb()}
              className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/6 px-2.5 py-1 text-[11px] font-semibold text-rose-400 transition hover:bg-rose-500/12"
            >
              Borrar DB
            </button>
          </div>
          <CalculatorConsole
            manualRecords={manualFinance}
            ocrRecords={ocrFinance}
            ocrTotals={latestOcrTotals}
            ocrDocLabel={latestOcr?.file_name ?? undefined}
          />
        </div>
      )}

      {allRecords.length === 0 && ocrFinance.length === 0 && (
        <div className="glass p-6 text-center lg:col-span-2">
          <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
          <p className="mt-2 text-sm text-muted-foreground">
            Registra movimientos o{" "}
            <Link to="/scanner" className="text-neon hover:underline">
              escanea un Balance o P&L
            </Link>{" "}
            para activar la consola de flujo de caja.
          </p>
        </div>
      )}
    </div>
  );
}
