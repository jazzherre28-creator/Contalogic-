import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, RefreshCw, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Indicator = {
  key: string;
  label: string;
  value: number;
  unit: string;
  source: string | null;
  description: string | null;
  updated_at: string;
};

type TrmRecord = {
  valor: string;
  vigenciadesde: string;
};

const indicatorAliases: string[][] = [
  ["uvt", "uvt_2026"],
  ["smlv", "smmlv_2026"],
  ["aux_transporte_2026"],
  ["iva_general"],
  ["renta_pj"],
];

const withTimeout = <T,>(request: PromiseLike<T>, timeoutMs: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("La fuente tardó demasiado en responder.")),
      timeoutMs,
    );
    Promise.resolve(request).then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });

const fmtValue = (indicator: Indicator) => {
  if (indicator.unit === "%") return `${Number(indicator.value).toFixed(2)}%`;
  if (indicator.unit === "COP/USD") {
    return `$${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(Number(indicator.value))} / USD`;
  }
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(indicator.value));
};

const getTrm = async (): Promise<Indicator> => {
  const url = new URL("https://www.datos.gov.co/resource/32sa-8pi3.json");
  url.searchParams.set("$limit", "1");
  url.searchParams.set("$order", "vigenciadesde DESC");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    throw new Error(`La fuente oficial de TRM respondió ${response.status}.`);
  }

  const records = (await response.json()) as TrmRecord[];
  const record = records[0];
  const value = Number(record?.valor);
  const effectiveDateValue = record?.vigenciadesde?.slice(0, 10);
  const effectiveDate = effectiveDateValue
    ? new Date(`${effectiveDateValue}T12:00:00.000Z`)
    : new Date(Number.NaN);
  if (!Number.isFinite(value) || value <= 0 || Number.isNaN(effectiveDate.getTime())) {
    throw new Error("La fuente oficial de TRM devolvió datos no válidos.");
  }

  return {
    key: "trm",
    label: "TRM",
    value,
    unit: "COP/USD",
    source: "Superintendencia Financiera · Datos.gov.co",
    description: `Vigencia ${new Intl.DateTimeFormat("es-CO", { timeZone: "UTC" }).format(effectiveDate)}`,
    updated_at: effectiveDate.toISOString(),
  };
};

export function EconomicTicker() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [trm, setTrm] = useState<Indicator | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setError(null);

    const [databaseResult, trmResult] = await Promise.allSettled([
      Promise.resolve().then(() =>
        withTimeout(
          supabase
            .from("economic_indicators")
            .select("key,label,value,unit,source,description,updated_at")
            .order("key"),
          12000,
        ),
      ),
      Promise.resolve().then(() => withTimeout(getTrm(), 12000)),
    ]);

    if (requestId !== latestRequest.current) return;

    const errors: string[] = [];
    if (databaseResult.status === "fulfilled") {
      const { data, error: databaseError } = databaseResult.value;
      if (databaseError) {
        console.error("Error cargando indicadores económicos:", databaseError);
        errors.push("No se pudieron cargar los indicadores tributarios.");
      } else {
        const rows = (data ?? []) as Indicator[];
        const curated = indicatorAliases.flatMap((aliases) => {
          const row = aliases
            .map((key) => rows.find((indicator) => indicator.key === key))
            .find((indicator) => indicator !== undefined);
          return row ? [row] : [];
        });
        setIndicators(curated);
      }
    } else {
      console.error("Error cargando indicadores económicos:", databaseResult.reason);
      errors.push("No se pudieron cargar los indicadores tributarios.");
    }

    if (trmResult.status === "fulfilled") {
      setTrm(trmResult.value);
    } else {
      console.error("Error actualizando TRM oficial:", trmResult.reason);
      errors.push("No se pudo actualizar la TRM oficial.");
    }

    setError(errors.length ? errors.join(" ") : null);
    setUpdatedAt(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();

    const refresh = window.setInterval(() => void load(), 15 * 60 * 1000);

    return () => {
      latestRequest.current += 1;
      window.clearInterval(refresh);
    };
  }, [load]);

  const items = [...indicators, ...(trm ? [trm] : [])];
  const tickerContent = (
    <>
      {items.map((item) => (
        <span
          key={item.key}
          className="inline-flex shrink-0 flex-col font-mono text-xs"
          aria-label={`${item.label}: ${fmtValue(item)}. ${item.description ?? ""} Fuente: ${item.source ?? "No especificada"}`}
          title={[item.description, item.source].filter(Boolean).join(" · ")}
        >
          <span className="font-bold uppercase tracking-wider text-emerald-glow">
            {item.label}
            {!item.label.includes("2026") && " · 2026"}
          </span>
          <span className="text-foreground">{fmtValue(item)}</span>
        </span>
      ))}
      {items.length === 0 && (
        <span className="text-xs text-muted-foreground">
          {loading ? "Cargando indicadores…" : "Indicadores no disponibles"}
        </span>
      )}
    </>
  );

  return (
    <section
      aria-label="Indicadores económicos y tributarios"
      className="mx-3 mt-3 flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-[oklch(0.7_0.22_245/0.35)] bg-[oklch(0.13_0.02_260/0.85)] backdrop-blur-md"
    >
      <div className="flex shrink-0 items-center gap-2 bg-[var(--gradient-neon)] px-3 py-3 text-[oklch(0.12_0.02_260)] shadow-[var(--shadow-neon)]">
        <TrendingUp aria-hidden="true" className="h-4 w-4" />
        <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] sm:inline">
          Indicadores
        </span>
      </div>

      <div className="ticker-track min-w-0 flex-1 py-2" aria-busy={loading}>
        <div className={`ticker-content ${items.length ? "ticker-content-moving" : ""}`}>
          <div className="ticker-group">{tickerContent}</div>
          {items.length > 0 && (
            <div className="ticker-group" aria-hidden="true">
              {tickerContent}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 px-3">
        {error && (
          <span
            role="alert"
            className="flex max-w-40 items-center gap-1 text-[10px] text-amber-300"
            title={error}
          >
            <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Actualización incompleta</span>
          </span>
        )}
        <span className="hidden text-[10px] font-mono text-muted-foreground lg:inline">
          {updatedAt
            ? `Consulta ${new Date(updatedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`
            : ""}
        </span>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Actualizar indicadores económicos y tributarios"
          title={error ?? "Actualizar indicadores"}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw
            aria-hidden="true"
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          <span className="hidden text-[10px] font-medium sm:inline">Actualizar</span>
        </button>
      </div>
    </section>
  );
}
