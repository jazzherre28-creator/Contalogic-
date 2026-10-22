import { createFileRoute, Navigate } from "@tanstack/react-router";
import { TransportTripCalculator } from "@/components/TransportTripCalculator";
import { useAuth } from "@/lib/auth-context";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/_app/calcutrans")({
  component: CalcuTransPage,
});

function CalcuTransPage() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando CalcuTrans…</div>;
  }
  if (!user || profile?.sector !== "transporte") {
    return <Navigate to="/calculator" />;
  }

  return (
    <div className="grid gap-4">
      <header className="glass flex flex-wrap items-center justify-between gap-4 border border-neon/15 p-5">
        <div className="flex items-center gap-3">
          <span className="rounded-xl border border-neon/25 bg-neon/10 p-3 text-neon">
            <Truck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">CalcuTrans</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Control independiente de fletes, costos, caja y carga terrestre.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
          Transporte
        </span>
      </header>
      <TransportTripCalculator userId={user.id} profile={profile} />
    </div>
  );
}
