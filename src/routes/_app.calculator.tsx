import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CATEGORIES, SECTOR_LABEL } from "@/lib/sectors";
import {
  Calculator,
  Plus,
  Minus,
  Trash2,
  History,
  FileDown,
  FileSpreadsheet,
  BarChart3,
  ScanLine,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { generateCalculatorReport } from "@/lib/pdf-report";
import { exportCalculatorXLSX } from "@/lib/excel-report";
import { CalculatorConsole } from "@/components/CalculatorConsole";
import type { FinanceRecord } from "@/lib/unified-finance";
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
  source: "manual" | "ocr" | "legacy";
};

async function loadRecordsBySource(userId: string, source: Rec["source"]): Promise<Rec[]> {
  const pageSize = 1000;
  const records: Rec[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("financial_records")
      .select("*")
      .eq("user_id", userId)
      .eq("source", source)
      .order("recorded_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as Rec[];
    records.push(...page);
    if (page.length < pageSize) return records;
  }
}

function CalculatorPage() {
  const { user, profile } = useAuth();
  const cats = useMemo(() => (profile?.sector ? CATEGORIES[profile.sector] : []), [profile]);
  const [activeKey, setActiveKey] = useState<string>(cats[0]?.key ?? "");
  const [display, setDisplay] = useState("0");
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<Rec[]>([]);
  const [allRecords, setAllRecords] = useState<Rec[]>([]);
  const [legacyRecords, setLegacyRecords] = useState<Rec[]>([]);
  const [ocrImportedRecords, setOcrImportedRecords] = useState<Rec[]>([]);
  const [ocrDocs, setOcrDocs] = useState<
    Array<{
      id: string;
      doc_type: "balance" | "pnl";
      file_name: string | null;
      created_at: string;
    }>
  >([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!activeKey && cats[0]) setActiveKey(cats[0].key);
  }, [cats, activeKey]);

  const loadHistory = async () => {
    if (!user) return;
    try {
      const [recentResult, allRecordsResult, legacyRecordsResult, ocrRecordsResult, ocrResult] =
        await Promise.all([
          supabase
            .from("financial_records")
            .select("*")
            .eq("user_id", user.id)
            .eq("source", "manual")
            .order("recorded_at", { ascending: false })
            .limit(15),
          loadRecordsBySource(user.id, "manual"),
          loadRecordsBySource(user.id, "legacy"),
          loadRecordsBySource(user.id, "ocr"),
          supabase
            .from("ocr_documents")
            .select("id, doc_type, file_name, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);
      const failed = [recentResult, ocrResult].find((result) => result.error);
      if (failed?.error) throw failed.error;
      setHistory((recentResult.data ?? []) as Rec[]);
      setAllRecords(allRecordsResult);
      setLegacyRecords(legacyRecordsResult);
      setOcrImportedRecords(ocrRecordsResult);
      setOcrDocs((ocrResult.data ?? []) as typeof ocrDocs);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al cargar los movimientos");
    }
  };
  useEffect(() => {
    void loadHistory();
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
        source: "manual",
      });
      if (error) throw error;
      toast.success(
        `${activeCat.kind === "income" ? "Ingreso" : "Egreso"} registrado · ${activeCat.label}`,
      );
      setDisplay("0");
      setNote("");
      await loadHistory();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("financial_records")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("source", "manual");
      if (error) throw error;
      await loadHistory();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el movimiento");
    }
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
    [allRecords],
  );

  const classifyLegacyRecord = async (id: string, source: "manual" | "ocr") => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("financial_records")
        .update({ source })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("source", "legacy")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("El registro ya fue clasificado o no está disponible.");
      toast.success(
        source === "manual"
          ? "Registro incluido en análisis manual"
          : "Registro separado como origen OCR",
      );
      await loadHistory();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo clasificar el registro");
    }
  };

  const deleteManualRecords = async () => {
    if (!user || allRecords.length === 0) return;
    const ok = window.confirm(
      `Se eliminarán ${allRecords.length} movimientos manuales. Los documentos OCR y los registros sin origen confirmado se conservarán. ¿Deseas continuar?`,
    );
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("financial_records")
        .delete()
        .eq("user_id", user.id)
        .eq("source", "manual");
      if (error) throw error;
      toast.success("Movimientos manuales eliminados; documentos OCR conservados");
      await loadHistory();
    } catch (err: unknown) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Error al borrar movimientos manuales");
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
              onClick={() => {
                if (allRecords.length === 0) {
                  toast.error("Sin movimientos para reportar");
                  return;
                }
                generateCalculatorReport({
                  profile: profile ?? {},
                  records: allRecords.map((r) => ({
                    category: r.category,
                    amount: Number(r.amount),
                    kind: r.kind,
                    note: r.note,
                    recorded_at: r.recorded_at,
                  })),
                });
                toast.success("Reporte PDF generado");
              }}
              disabled={allRecords.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-[oklch(0.92_0.2_105/0.5)] bg-[oklch(0.92_0.2_105/0.1)] px-2.5 py-1 text-[11px] font-semibold text-emerald-glow transition hover:bg-[oklch(0.92_0.2_105/0.2)]"
            >
              <FileDown className="h-3 w-3" /> PDF
            </button>
            <button
              onClick={() => {
                if (allRecords.length === 0) {
                  toast.error("Sin movimientos para exportar");
                  return;
                }
                exportCalculatorXLSX({
                  records: allRecords.map((r) => ({
                    category: r.category,
                    amount: Number(r.amount),
                    kind: r.kind,
                    note: r.note,
                    recorded_at: r.recorded_at,
                  })),
                });
                toast.success("Excel generado");
              }}
              disabled={allRecords.length === 0}
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

      <div className="glass space-y-4 p-5 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-glow" />
            <div>
              <h3 className="text-sm font-semibold">Análisis de movimientos manuales</h3>
              <p className="text-xs text-muted-foreground">
                Solo incluye registros capturados en esta calculadora; OCR y origen pendiente quedan
                fuera.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadHistory()}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:bg-white/5"
            >
              <RefreshCw className="h-3 w-3" /> Actualizar
            </button>
            <button
              onClick={() => void deleteManualRecords()}
              disabled={allRecords.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/6 px-2.5 py-1 text-[11px] font-semibold text-rose-400 transition hover:bg-rose-500/12 disabled:opacity-40"
            >
              Borrar movimientos manuales
            </button>
          </div>
        </div>
        <CalculatorConsole manualRecords={manualFinance} />
      </div>

      {legacyRecords.length > 0 && (
        <section className="glass space-y-3 p-5 lg:col-span-2">
          <div>
            <h3 className="text-sm font-semibold text-amber-300">
              Registros antiguos sin origen confirmado ({legacyRecords.length})
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Se excluyen de los indicadores y reportes para evitar mezclar movimientos manuales con
              importaciones OCR. Confirma el origen de cada registro antes de incluirlo.
            </p>
          </div>
          <ul className="space-y-2">
            {legacyRecords.map((record) => (
              <li
                key={record.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/15 bg-amber-500/[0.03] px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium">
                    {record.category} · {fmt(record.amount)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {record.kind === "income" ? "Ingreso" : "Egreso"} ·{" "}
                    {new Date(record.recorded_at).toLocaleString("es-CO")}
                    {record.note ? ` · ${record.note}` : ""}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => void classifyLegacyRecord(record.id, "manual")}
                    className="rounded-md border border-emerald-500/35 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/10"
                  >
                    Confirmar manual
                  </button>
                  <button
                    onClick={() => void classifyLegacyRecord(record.id, "ocr")}
                    className="rounded-md border border-neon/35 px-2.5 py-1 text-[10px] font-semibold text-neon hover:bg-neon/10"
                  >
                    Marcar OCR
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ocrImportedRecords.length > 0 && (
        <section className="glass p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-neon">
            Partidas OCR separadas ({ocrImportedRecords.length})
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Estas partidas se conservan fuera del flujo de caja manual. Consulta el documento y su
            análisis en el escáner.
          </p>
        </section>
      )}

      <section className="glass p-5 lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-neon">
              Documentos OCR · análisis independiente
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Los saldos y subtotales del balance/P&amp;L no se convierten en movimientos de caja.
            </p>
          </div>
          <Link
            to="/scanner"
            className="inline-flex items-center gap-1.5 rounded-md border border-neon/40 bg-neon/10 px-2.5 py-1 text-[11px] font-semibold text-neon transition hover:bg-neon/20"
          >
            <ScanLine className="h-3 w-3" /> Abrir escáner OCR
          </Link>
        </div>
        {ocrDocs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay documentos OCR recientes.</p>
        ) : (
          <ul className="space-y-2">
            {ocrDocs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {doc.file_name ?? "Documento sin nombre"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {doc.doc_type === "balance"
                      ? "Estado de situación financiera"
                      : "Estado de resultados"}{" "}
                    · {new Date(doc.created_at).toLocaleString("es-CO")}
                  </div>
                </div>
                <span className="shrink-0 rounded border border-neon/20 px-2 py-0.5 text-[9px] font-mono uppercase text-neon">
                  OCR
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
