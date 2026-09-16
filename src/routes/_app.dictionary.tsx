import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BookOpen, Search, Filter, Loader2 } from "lucide-react";
import { SECTOR_LABEL, type SectorKey } from "@/lib/sectors";

export const Route = createFileRoute("/_app/dictionary")({
  component: DictionaryPage,
});

type Term = {
  id: string;
  term: string;
  definition: string;
  estatuto_article: string | null;
  sectors: string[];
  entity_types: string[];
};

function DictionaryPage() {
  const { profile } = useAuth();
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sectorFilter, setSectorFilter] = useState<"mine" | "all" | SectorKey>("mine");

  useEffect(() => {
    supabase
      .from("tax_dictionary")
      .select("*")
      .order("term", { ascending: true })
      .then(({ data }) => {
        setTerms((data ?? []) as Term[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    let list = terms;
    if (sectorFilter === "mine" && profile?.sector) {
      list = list.filter((t) => t.sectors.includes("todos") || t.sectors.includes(profile.sector!));
    } else if (sectorFilter !== "mine" && sectorFilter !== "all") {
      list = list.filter((t) => t.sectors.includes("todos") || t.sectors.includes(sectorFilter));
    }
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (t) =>
          t.term.toLowerCase().includes(needle) ||
          t.definition.toLowerCase().includes(needle) ||
          (t.estatuto_article ?? "").toLowerCase().includes(needle)
      );
    }
    return list;
  }, [terms, q, sectorFilter, profile]);

  return (
    <div className="space-y-4">
      <div className="glass-neon p-5">
        <span className="chip chip-neon">
          <BookOpen className="h-3 w-3" /> DICCIONARIO ESTATUTO TRIBUTARIO
        </span>
        <h1 className="mt-2 text-xl font-bold sm:text-2xl">Glosario fiscal contextual</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {filtered.length} de {terms.length} términos · adaptado a tu sector
        </p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar término, artículo o concepto…"
              className="input-neon w-full pl-9"
            />
          </div>
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value as typeof sectorFilter)}
            className="input-neon sm:w-56"
          >
            <option value="mine">⚡ Mi sector ({SECTOR_LABEL[profile?.sector ?? "transporte"]})</option>
            <option value="all">Todos los sectores</option>
            <option value="transporte">Transporte</option>
            <option value="comercio">Comercio</option>
            <option value="servicios">Servicios</option>
            <option value="manufactura">Manufactura</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="glass grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-neon" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.length === 0 ? (
            <div className="glass col-span-full px-5 py-8 text-center text-sm text-muted-foreground">
              No hay coincidencias. Prueba con otro término.
            </div>
          ) : (
            filtered.map((t) => (
              <article
                key={t.id}
                className="glass space-y-2 p-4 transition hover:border-[oklch(0.7_0.22_245/0.4)]"
              >
                <header className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-neon">{t.term}</h3>
                  {t.estatuto_article && (
                    <span className="chip font-mono text-[10px] !text-emerald-glow !border-[oklch(0.92_0.2_105/0.5)]">
                      {t.estatuto_article}
                    </span>
                  )}
                </header>
                <p className="text-sm leading-relaxed text-foreground/90">{t.definition}</p>
                <footer className="flex flex-wrap gap-1">
                  {t.sectors.filter((s) => s !== "todos").map((s) => (
                    <span key={s} className="chip text-[9px]">
                      {SECTOR_LABEL[s as SectorKey] ?? s}
                    </span>
                  ))}
                  {t.sectors.includes("todos") && (
                    <span className="chip chip-neon text-[9px]">TODOS LOS SECTORES</span>
                  )}
                </footer>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
