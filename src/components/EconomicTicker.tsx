import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, RefreshCw } from "lucide-react";

type Indicator = {
  key: string;
  label: string;
  value: number;
  unit: string;
  source: string | null;
  description: string | null;
  updated_at: string;
};

const fmtValue = (i: Indicator) => {
  if (i.unit === "%") return `${Number(i.value).toFixed(2)}%`;
  if (i.unit === "COP/USD")
    return `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(Number(i.value))} / USD`;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(i.value));
};

export function EconomicTicker() {
  const [items, setItems] = useState<Indicator[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("economic_indicators")
      .select("*")
      .order("key");

    if (error) {
      console.error("Error cargando indicadores económicos:", error);
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      setItems(data as Indicator[]);
      const latest = data.reduce(
        (acc, cur) =>
          new Date(cur.updated_at) > new Date(acc) ? cur.updated_at : acc,
        data[0].updated_at,
      );
      setUpdatedAt(latest);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel("econ-ind")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "economic_indicators" },
        () => load(),
      )
      .subscribe();

    const refresh = setInterval(load, 30 * 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(refresh);
    };
  }, []);

  if (items.length === 0) return null;

  const loop = [...items, ...items];
  const hasUVR = items.some((item) => item.key.toLowerCase().includes("uvr"));
  const titleLabel = hasUVR ? "UVR · LIVE" : "Indicadores · LIVE";

  return (
    <div className="relative mx-3 mt-3 overflow-hidden rounded-xl border border-[oklch(0.7_0.22_245/0.35)] bg-[oklch(0.13_0.02_260/0.85)] backdrop-blur-md">
      <div className="absolute inset-y-0 left-0 z-10 flex items-center gap-2 bg-[var(--gradient-neon)] px-3 py-2 text-[oklch(0.12_0.02_260)] shadow-[var(--shadow-neon)]">
        <TrendingUp className="h-4 w-4" />
        <span className="hidden text-[10px] font-bold uppercase tracking-[0.2em] sm:inline">
          {titleLabel}
        </span>
      </div>

      <div className="overflow-hidden py-2 pl-24 pr-16">
        <div className="ticker-track">
          {loop.map((i, idx) => (
            <span
              key={`${i.key}-${idx}`}
              className="inline-flex items-baseline gap-2 font-mono text-xs"
              title={i.description ?? undefined}
            >
              <span className="font-bold uppercase tracking-wider text-emerald-glow">
                {i.label}
              </span>
              <span className="text-foreground">{fmtValue(i)}</span>
              {i.source && (
                <span className="text-[10px] text-muted-foreground">
                  · {i.source}
                </span>
              )}
              <span className="text-[oklch(0.7_0.22_245/0.5)]">|</span>
            </span>
          ))}
        </div>
      </div>

      <div className="absolute inset-y-0 right-0 z-10 flex items-center gap-1.5 rounded-l-xl bg-[oklch(0.13_0.02_260/0.95)] px-3 text-[10px] font-mono text-muted-foreground">
        <RefreshCw className="h-3 w-3" />
        <span className="hidden md:inline">
          {loading ? "Actualizando…" : updatedAt ? `Actualizado ${new Date(updatedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}` : "—"}
        </span>
      </div>
    </div>
  );
}
