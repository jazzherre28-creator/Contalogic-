import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Building2, User, Truck, ShoppingBag, Briefcase, Factory, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { EntityType, SectorKey } from "@/lib/sectors";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

const SECTORS: { key: SectorKey; label: string; icon: typeof Truck; desc: string }[] = [
  { key: "transporte", label: "Transporte", icon: Truck, desc: "Fletes · ACPM · Flota" },
  { key: "comercio", label: "Comercio", icon: ShoppingBag, desc: "Ventas · Mercancía" },
  { key: "servicios", label: "Servicios", icon: Briefcase, desc: "Honorarios · Consultoría" },
  { key: "manufactura", label: "Manufactura", icon: Factory, desc: "Producción · Insumos" },
];

function OnboardingPage() {
  const nav = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [entity, setEntity] = useState<EntityType | null>(null);
  const [sector, setSector] = useState<SectorKey | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [nit, setNit] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/auth" });
    else if (profile?.onboarded) nav({ to: "/dashboard" });
  }, [user, profile, loading, nav]);

  const submit = async () => {
    if (!user || !entity || !sector) return;
    setBusy(true);
    setSaveError(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email: user.email ?? null,
            entity_type: entity,
            sector,
            display_name: displayName || (user.email?.split("@")[0] ?? null),
            nit: nit.trim() || null,
            onboarded: true,
          },
          { onConflict: "id" },
        )
        .select("id, onboarded")
        .maybeSingle();
      if (error) throw error;
      if (!data?.onboarded) {
        throw new Error(
          "No se confirmó el guardado del perfil. Verifica tu sesión y vuelve a intentar.",
        );
      }
      await refreshProfile();
      toast.success("Perfil configurado · Bienvenido a la terminal");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al guardar el perfil.";
      setSaveError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <div className="glow-orb right-[-10%] top-[-10%] h-[400px] w-[400px] bg-[oklch(0.7_0.22_245/0.5)]" />
      <div className="relative w-full max-w-2xl">
        <div className="mb-6 text-center">
          <span className="chip chip-neon">PASO 1 · CONFIGURACIÓN INICIAL</span>
          <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Configura tu perfil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            La terminal se adapta a tu tipo de entidad y sector económico.
          </p>
        </div>

        <div className="glass space-y-6 p-6">
          {/* Display name */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Nombre del operador
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={user?.email?.split("@")[0] ?? "Tu nombre"}
              className="input-neon mt-1"
            />
          </div>

          {/* NIT */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              NIT / Cédula (opcional · activa calendario DIAN exacto)
            </label>
            <input
              type="text"
              value={nit}
              onChange={(e) => setNit(e.target.value)}
              placeholder="Ej: 900123456-7"
              className="input-neon mt-1 font-mono"
            />
            <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              Usaremos el último dígito para mostrarte tus fechas exactas de vencimiento DIAN.
            </p>
          </div>

          {/* Entity */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Tipo de Entidad
            </label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {(
                [
                  { k: "natural", label: "Persona Natural", icon: User, desc: "RST · Cédulas" },
                  {
                    k: "juridica",
                    label: "Persona Jurídica",
                    icon: Building2,
                    desc: "Régimen Ordinario · Art. 107",
                  },
                ] as const
              ).map(({ k, label, icon: Icon, desc }) => {
                const active = entity === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setEntity(k)}
                    className={`group flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition ${
                      active
                        ? "border-[oklch(0.7_0.22_245)] bg-[oklch(0.7_0.22_245/0.1)] shadow-[var(--shadow-neon)]"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${active ? "text-neon" : "text-muted-foreground"}`} />
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sector */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Sector Económico
            </label>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SECTORS.map(({ key, label, icon: Icon, desc }) => {
                const active = sector === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSector(key)}
                    className={`flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition ${
                      active
                        ? "border-[oklch(0.92_0.2_105)] bg-[oklch(0.92_0.2_105/0.12)] shadow-[var(--shadow-emerald)]"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${active ? "text-emerald-glow" : "text-muted-foreground"}`}
                    />
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      {desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {saveError && (
            <div
              role="alert"
              className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-200"
            >
              No se pudo activar la terminal: {saveError}
            </div>
          )}

          <button
            disabled={!entity || !sector || busy}
            onClick={submit}
            className="btn-emerald w-full"
          >
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
              </span>
            ) : (
              "Activar terminal"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
