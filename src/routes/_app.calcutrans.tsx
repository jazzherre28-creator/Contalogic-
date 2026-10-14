import { createFileRoute, Navigate } from "@tanstack/react-router";
import { TransportTripCalculator } from "@/components/TransportTripCalculator";
import { useAuth } from "@/lib/auth-context";

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
      <div className="glass p-4">
        <h1 className="text-lg font-semibold">CalcuTrans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Control independiente de fletes, costos, caja y carga terrestre.
        </p>
      </div>
      <TransportTripCalculator userId={user.id} profile={profile} />
    </div>
  );
}
