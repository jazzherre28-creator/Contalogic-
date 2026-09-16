import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Supabase auto-procesa el hash de recovery y emite PASSWORD_RECOVERY.
    // Verificamos sesión válida tras un breve momento.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session));
    }, 400);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < 6) {
      toast.error("Mínimo 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Contraseña actualizada");
      await supabase.auth.signOut();
      nav({ to: "/auth" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <div className="glow-orb left-[-10%] top-[-10%] h-[420px] w-[420px] bg-[oklch(0.7_0.22_245/0.6)]" />
      <div className="glow-orb bottom-[-15%] right-[-10%] h-[480px] w-[480px] bg-[oklch(0.92_0.2_105/0.5)]" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 text-center">
          <ShieldCheck className="mx-auto mb-2 h-10 w-10 text-emerald-glow" />
          <h1 className="text-2xl font-bold">
            <span className="text-neon">Nueva</span>{" "}
            <span className="text-emerald-glow">contraseña</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Define una contraseña segura para tu terminal
          </p>
        </div>

        {hasSession === false ? (
          <div className="glass-neon space-y-4 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              El enlace de recuperación no es válido o expiró. Solicita uno nuevo.
            </p>
            <button onClick={() => nav({ to: "/forgot-password" })} className="btn-emerald w-full">
              Solicitar nuevo enlace
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass-neon scanline relative space-y-4 p-6">
            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Nueva contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neon opacity-70" />
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-neon !pl-9 !pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition hover:text-neon"
                  aria-label={showPwd ? "Ocultar" : "Mostrar"}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Confirmar contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-glow opacity-70" />
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input-neon !pl-9"
                />
              </div>
            </div>

            <button type="submit" disabled={busy || hasSession === null} className="btn-emerald w-full">
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Actualizando…
                </span>
              ) : (
                "Actualizar contraseña"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
