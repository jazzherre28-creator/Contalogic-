import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/auth-redirect";
import { useAuth } from "@/lib/auth-context";
import { Mail, Lock, Sparkles, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { user, profile, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("confirmed") === "1",
  );

  useEffect(() => {
    if (loading || showConfirmation) return;
    if (user) {
      if (profile && !profile.onboarded) nav({ to: "/onboarding" });
      else if (profile?.onboarded) nav({ to: "/dashboard" });
    }
  }, [user, profile, loading, nav, showConfirmation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: getAuthRedirectUrl("/auth?confirmed=1") },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Cuenta creada. Continúa con la configuración de tu terminal.");
          nav({ to: "/onboarding" });
        } else {
          setShowConfirmation(true);
          setMode("signin");
          toast.success("Cuenta creada. Confirma tu correo para continuar.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setShowConfirmation(false);
        toast.success("Acceso autorizado");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      toast.error(msg.includes("Invalid login") ? "Credenciales inválidas" : msg);
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
          <div className="mb-3 inline-flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-[var(--gradient-neon)] pulse-neon" />
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
              v1 · build 24.04
            </span>
          </div>
          <h1 className="text-3xl font-bold">
            <span className="text-neon">CONTALOGIC</span>{" "}
            <span className="text-emerald-glow">AI+</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Terminal Financiera Universal · Acceso autenticado
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-neon scanline relative space-y-4 p-6">
          {showConfirmation && (
            <div
              role="status"
              className="space-y-2 rounded-md border border-emerald-400/25 bg-emerald-400/[0.05] p-3 text-xs text-emerald-100"
            >
              <p className="font-semibold">Tu correo fue confirmado.</p>
              <p>
                Estás en el acceso oficial de Contalogic. Inicia sesión para guardar tu perfil y
                activar la terminal.
              </p>
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    setShowConfirmation(false);
                    nav({ to: profile?.onboarded ? "/dashboard" : "/onboarding" });
                  }}
                  className="font-semibold text-neon underline"
                >
                  Continuar a mi terminal
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                mode === "signin"
                  ? "bg-[oklch(0.7_0.22_245/0.15)] text-neon"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                mode === "signup"
                  ? "bg-[oklch(0.7_0.22_245/0.15)] text-neon"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Registro
            </button>
          </div>

          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neon opacity-70" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="gerencia@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-neon !pl-9"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neon opacity-70" />
              <input
                type={showPwd ? "text" : "password"}
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-neon !pl-9 !pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition hover:text-neon"
                title={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex flex-col gap-2 pt-1 text-[10px] uppercase tracking-widest">
              {mode === "signin" ? (
                <Link to="/forgot-password" className="font-mono text-neon hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="font-mono text-neon hover:underline"
                >
                  ¿Ya tienes cuenta? Inicia sesión
                </button>
              )}
            </div>
          </div>

          <button type="submit" disabled={busy} className="btn-emerald w-full">
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Procesando…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                {mode === "signup" ? "Crear cuenta" : "Iniciar sesión"}
              </span>
            )}
          </button>

          <p className="text-center font-mono text-[10px] text-muted-foreground">
            Sesión cifrada · Datos aislados por usuario (RLS)
          </p>
        </form>
      </div>
    </div>
  );
}
