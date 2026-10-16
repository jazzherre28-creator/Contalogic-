import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useFinance } from "@/lib/finance-context";
import { ScanLine, FileText, Loader2, Trash2, Upload, Sparkles, X, FileDown, FileSpreadsheet, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { generateScannerReport } from "@/lib/pdf-report";
import { extractFromFile } from "@/lib/file-extractors";
import { ScannerAnalytics, computeAdvancedAnalytics } from "@/components/AdvancedAnalytics";
import { exportScannerAnalysisXLSX } from "@/lib/excel-report";
import { ComparativeFinancialAnalysis } from "@/components/ComparativeFinancialAnalysis";

export const Route = createFileRoute("/_app/scanner")({
  component: ScannerPage,
});

type DocType = "balance" | "pnl";
type Doc = {
  id: string;
  doc_type: DocType;
  raw_text: string | null;
  parsed_data: {
    totals?: Record<string, number>;
    lineItems?: Array<{ label: string; value: number }>;
    meta?: {
      entryCount?: number;
      charCount?: number;
      source?: string;
      unitLabel?: string;
      unitMultiplier?: number;
    };
    sheetSummary?: Array<{ sheet: string; rows: number }>;
  } | null;
  file_name: string | null;
  created_at: string;
};

function ScannerPage() {
  const { user, profile } = useAuth();
  const { actualizarDesdeOCR } = useFinance();
  const [progress, setProgress] = useState<{ kind: DocType; pct: number; msg?: string } | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analysisDoc, setAnalysisDoc] = useState<{ id: string; markdown: string; fileName: string } | null>(null);
  const [activeAnalyticsId, setActiveAnalyticsId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ocr_documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setDocs((data ?? []) as Doc[]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const analyze = async (doc: Doc) => {
    if (!profile) return;
    setAnalyzing(doc.id);
    try {
      const { data, error } = await supabase.functions.invoke("lex-ai-analyze", {
        body: {
          rawText: doc.raw_text ?? "",
          totals: doc.parsed_data?.totals ?? {},
          lineItems: doc.parsed_data?.lineItems ?? [],
          docType: doc.doc_type,
          entityType: profile.entity_type,
          sector: profile.sector,
          meta: doc.parsed_data?.meta,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysisDoc({
        id: doc.id,
        markdown: data?.analysis ?? "Sin respuesta.",
        fileName: doc.file_name ?? "Documento",
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al analizar");
    } finally {
      setAnalyzing(null);
    }
  };

  const handleFile = async (file: File, docType: DocType) => {
    if (!user) return;
    setProgress({ kind: docType, pct: 0 });
    try {
      const result = await extractFromFile(file, (pct, msg) =>
        setProgress({ kind: docType, pct, msg })
      );
      const { text, totals, meta, sheetSummary, lineItems } = result;
      const { error } = await supabase.from("ocr_documents").insert({
        user_id: user.id,
        doc_type: docType,
        raw_text: text,
        parsed_data: { totals, meta, sheetSummary, lineItems },
        file_name: file.name,
      });
      if (error) throw error;
      
      // ACTUALIZAR ESTADO GLOBAL CON DATOS DEL OCR
      actualizarDesdeOCR({ totals, lineItems }, docType);
      
      toast.success(
        `${docType === "balance" ? "Estado de Situación Financiera" : "P&L"} · ${Object.keys(totals).length} partidas · estado global actualizado`
      );
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error procesando archivo");
    } finally {
      setProgress(null);
    }
  };

  const remove = async (id: string) => {
    await supabase.from("ocr_documents").delete().eq("id", id);
    if (activeAnalyticsId === id) setActiveAnalyticsId(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <UploadCard
          title="Estado de Situación Financiera"
          subtitle="Activos · Pasivos · Patrimonio"
          accent="neon"
          docType="balance"
          progress={progress?.kind === "balance" ? progress : null}
          onFile={(f) => handleFile(f, "balance")}
        />
        <UploadCard
          title="Estado de Resultados (P&L)"
          subtitle="Ingresos · Costos · Gastos"
          accent="emerald"
          docType="pnl"
          progress={progress?.kind === "pnl" ? progress : null}
          onFile={(f) => handleFile(f, "pnl")}
        />
      </div>

      <ComparativeFinancialAnalysis docs={docs} />

      <div className="glass p-5">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-neon" />
          <h3 className="text-sm font-semibold">Documentos procesados</h3>
        </div>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay documentos. Carga una imagen, PDF, Word o Excel de tu Estado de Situación Financiera o P&L.
          </p>
        ) : (
          <ul className="space-y-3">
            {docs.map((d) => {
              const totals = d.parsed_data?.totals ?? {};
              const meta = d.parsed_data?.meta;
              const entryCount = Object.keys(totals).length;
              const isAnalyticsOpen = activeAnalyticsId === d.id;
              return (
                <li
                  key={d.id}
                  className="rounded-lg border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`chip ${
                            d.doc_type === "balance" ? "chip-neon" : "!text-emerald-glow !border-[oklch(0.92_0.2_105/0.5)]"
                          }`}
                        >
                          {d.doc_type === "balance" ? "ESTADO S.F." : "P&L"}
                        </span>
                        <span className="truncate text-sm font-medium">
                          {d.file_name ?? "Documento"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                        <span>{new Date(d.created_at).toLocaleString("es-CO")}</span>
                        {entryCount > 0 && (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-glow">
                            {entryCount} partidas
                          </span>
                        )}
                        {meta?.source && (
                          <span className="rounded bg-white/5 px-1.5 py-0.5">{meta.source}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        onClick={() => setActiveAnalyticsId(isAnalyticsOpen ? null : d.id)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[oklch(0.92_0.2_105/0.5)] bg-[oklch(0.92_0.2_105/0.1)] px-2.5 py-1.5 text-xs font-semibold text-emerald-glow transition hover:bg-[oklch(0.92_0.2_105/0.2)]"
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{isAnalyticsOpen ? "Ocultar" : "Consola"}</span>
                      </button>
                      <button
                        onClick={() => analyze(d)}
                        disabled={analyzing === d.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[oklch(0.7_0.22_245/0.5)] bg-[oklch(0.7_0.22_245/0.1)] px-2.5 py-1.5 text-xs font-semibold text-neon transition hover:bg-[oklch(0.7_0.22_245/0.2)] disabled:opacity-60"
                      >
                        {analyzing === d.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        <span className="hidden sm:inline">Analizar LEX AI</span>
                      </button>
                      <button
                        onClick={() => remove(d.id)}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-white/5 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {!isAnalyticsOpen && entryCount > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Abre la consola para ver las {entryCount} partidas extraídas y el análisis completo.
                    </p>
                  )}
                  {isAnalyticsOpen && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <ScannerAnalytics
                        totals={d.parsed_data?.totals ?? {}}
                        profile={profile ?? {}}
                        docType={d.doc_type}
                        meta={{ source: "documento" }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Modal análisis IA */}
      {analysisDoc && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setAnalysisDoc(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-neon relative max-h-[88vh] w-full max-w-4xl overflow-y-auto p-6"
          >
            <button
              onClick={() => setAnalysisDoc(null)}
              className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-neon" />
                <div>
                  <span className="chip chip-neon text-[9px]">ANÁLISIS LEX AI</span>
                  <h3 className="mt-1 text-base font-bold">{analysisDoc.fileName}</h3>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => {
                    const doc = docs.find((x) => x.id === analysisDoc.id);
                    if (!doc) return;
                    generateScannerReport({
                      profile: profile ?? {},
                      fileName: analysisDoc.fileName,
                      docType: doc.doc_type,
                      totals: doc.parsed_data?.totals ?? {},
                      analysisMarkdown: analysisDoc.markdown,
                    });
                    toast.success("Informe PDF generado");
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[oklch(0.92_0.2_105/0.5)] bg-[oklch(0.92_0.2_105/0.1)] px-2.5 py-1.5 text-xs font-semibold text-emerald-glow transition hover:bg-[oklch(0.92_0.2_105/0.2)]"
                >
                  <FileDown className="h-3.5 w-3.5" /> PDF
                </button>
                <button
                  onClick={() => {
                    const doc = docs.find((x) => x.id === analysisDoc.id);
                    if (!doc) return;
                    const totals = doc.parsed_data?.totals ?? {};
                    const a = computeAdvancedAnalytics(totals, doc.doc_type);
                    exportScannerAnalysisXLSX({
                      fileName: analysisDoc.fileName,
                      docType: doc.doc_type,
                      totals,
                      analysisMarkdown: analysisDoc.markdown,
                      projection: a.projection,
                    });
                    toast.success("Excel generado");
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[oklch(0.7_0.22_245/0.5)] bg-[oklch(0.7_0.22_245/0.1)] px-2.5 py-1.5 text-xs font-semibold text-neon transition hover:bg-[oklch(0.7_0.22_245/0.2)]"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                </button>
              </div>
            </div>

            {/* Visual analytics console */}
            {(() => {
              const doc = docs.find((x) => x.id === analysisDoc.id);
              if (!doc) return null;
              return (
                <div className="mb-5">
                  <ScannerAnalytics
                    totals={doc.parsed_data?.totals ?? {}}
                    profile={profile ?? {}}
                    docType={doc.doc_type}
                    meta={{ source: "documento" }}
                  />
                </div>
              );
            })()}

            <div className="border-t border-white/10 pt-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-neon">
                ✦ Asesor LEX AI · Recomendaciones de ahorro
              </div>
              <div
                className="prose prose-invert prose-sm max-w-none prose-headings:text-neon prose-strong:text-emerald-glow prose-li:my-0.5"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(analysisDoc.markdown) }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function renderMarkdown(md: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split(/\r?\n/);
  let html = "";
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^### /.test(line)) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h3>${formatInline(escape(line.slice(4)))}</h3>`;
    } else if (/^## /.test(line)) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h2>${formatInline(escape(line.slice(3)))}</h2>`;
    } else if (/^# /.test(line)) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h1>${formatInline(escape(line.slice(2)))}</h1>`;
    } else if (/^[-*]\s+/.test(line)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${formatInline(escape(line.replace(/^[-*]\s+/, "")))}</li>`;
    } else if (line.trim() === "") {
      if (inList) { html += "</ul>"; inList = false; }
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${formatInline(escape(line))}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function formatInline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function UploadCard({
  title,
  subtitle,
  accent,
  docType,
  progress,
  onFile,
}: {
  title: string;
  subtitle: string;
  accent: "neon" | "emerald";
  docType: DocType;
  progress: { pct: number; msg?: string } | null;
  onFile: (f: File) => void;
}) {
  const isNeon = accent === "neon";
  return (
    <label
      className={`relative block cursor-pointer p-5 transition ${
        isNeon ? "glass-neon" : "glass"
      }`}
      style={
        !isNeon
          ? { boxShadow: "var(--shadow-emerald), var(--shadow-glass)", borderColor: "oklch(0.92 0.2 105 / 0.4)" }
          : undefined
      }
    >
      <input
        type="file"
        accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="sr-only"
        disabled={progress !== null}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
      <div className="flex items-start gap-3">
        <div
          className={`rounded-md border p-2.5 ${
            isNeon
              ? "border-[oklch(0.7_0.22_245/0.5)] bg-[oklch(0.7_0.22_245/0.1)] text-neon"
              : "border-[oklch(0.92_0.2_105/0.5)] bg-[oklch(0.92_0.2_105/0.1)] text-emerald-glow"
          }`}
        >
          <ScanLine className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <div className="mt-4 rounded-md border border-dashed border-white/15 px-4 py-6 text-center">
        {progress === null ? (
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
            <Upload className="h-5 w-5" />
            <span className="text-sm">Toca para subir archivo</span>
            <span className="font-mono text-[10px] uppercase tracking-widest">
              JPG · PNG · PDF · DOCX · XLSX · CSV
            </span>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-neon" />
              {progress.msg ?? "Procesando"} · {progress.pct}%
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-[var(--gradient-neon)] transition-all"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Tipo: {docType}
      </div>
    </label>
  );
}
