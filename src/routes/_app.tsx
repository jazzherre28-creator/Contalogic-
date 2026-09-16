import { createFileRoute, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppHeader } from "@/components/AppHeader";
import { EconomicTicker } from "@/components/EconomicTicker";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const nav = useNavigate();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/auth" });
    else if (!profile?.onboarded) nav({ to: "/onboarding" });
  }, [user, profile, loading, nav]);

  if (loading || !user || !profile?.onboarded) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="glass flex items-center gap-3 px-6 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-neon" />
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Inicializando terminal…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <EconomicTicker />
      <AppHeader />
      <main className="mx-auto mt-4 max-w-7xl px-3 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
