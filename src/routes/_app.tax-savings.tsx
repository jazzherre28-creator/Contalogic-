import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { TaxSavingsPanel } from "@/components/TaxSavingsPanel";
import { TrendingDown, FileText } from "lucide-react";

export const Route = createFileRoute("/_app/tax-savings")({
  component: TaxSavingsPage,
});

type Doc = {
  id: string;
  doc_type: "balance" | "pnl";
  parsed_data: { totals?: Record<string, number> } | null;
  file_name: string | null;
  created_at: string;
};

function TaxSavingsPage() {
  const { user, profile } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedId, setSelectedId] = useState<string | "general">("general");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("ocr_documents")
      .select("id, doc_type, parsed_data, file_name, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setDocs((data ?? []) as Doc[]));
  }, [user]);

  const selected = docs.find((d) => d.id === selectedId);
  const totals = selected?.parsed_data?.totals ?? {};
  const docType = selected?.doc_type ?? "pnl";

  return (
    <div className="space-y-4">
      <div className="glass-neon p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-emerald-glow">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Ahorro de impuestos</h1>
            <p className="text-sm text-muted-foreground">
              Estrategias del Estatuto Tributario colombiano basadas en tu perfil y documentos escaneados.
            </p>
          </div>
        </div>
      </div>

      {docs.length > 0 && (
        <div className="glass p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-neon" />
            Fuente de análisis
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedId("general")}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                selectedId === "general"
                  ? "border-neon/50 bg-neon/10 text-neon"
                  : "border-white/10 text-muted-foreground hover:border-white/25"
              }`}
            >
              Guía general
            </button>
            {docs.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                  selectedId === d.id
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-glow"
                    : "border-white/10 text-muted-foreground hover:border-white/25"
                }`}
              >
                {d.file_name ?? "Documento"} ({d.doc_type === "balance" ? "Balance" : "P&L"})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="glass p-5">
        <TaxSavingsPanel
          totals={selectedId === "general" ? {} : totals}
          profile={profile ?? {}}
          docType={docType}
        />
      </div>
    </div>
  );
}
