import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/auth-redirect";
import { Mail, Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl("/reset-password"),
      });
      if (error) throw error;
      setSent(true);
      toast.success("Te enviamos un enlace de recuperación");
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
          <h1 className="text-2xl font-bold">
            <span className="text-neon">Recuperar</span>{" "}
            <span className="text-emerald-glow">acceso</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Te enviaremos un enlace seguro a tu correo
          </p>
        </div>

        {sent ? (
          <div className="glass-neon scanline relative space-y-4 p-6 text-center">
            <MailCheck className="mx-auto h-12 w-12 text-emerald-glow" />
            <h2 className="text-base font-semibold">Revisa tu bandeja</h2>
            <p className="text-sm text-muted-foreground">
              Si <span className="text-neon">{email}</span> tiene cuenta, recibirás un enlace para
              restablecer tu contraseña. El enlace expira en 1 hora.
            </p>
            <button onClick={() => nav({ to: "/auth" })} className="btn-emerald w-full">
              Volver a iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass-neon scanline relative space-y-4 p-6">
            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Email registrado
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

            <button type="submit" disabled={busy} className="btn-emerald w-full">
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando…
                </span>
              ) : (
                "Enviar enlace de recuperación"
              )}
            </button>

            <Link
              to="/auth"
              className="flex items-center justify-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-neon"
            >
              <ArrowLeft className="h-3 w-3" />
              Volver
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
