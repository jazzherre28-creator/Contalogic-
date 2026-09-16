import { useEffect, useRef, useState } from "react";
import { Bell, Check, Trash2, X, Sparkles, BellRing } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

type Notif = {
  id: string;
  title: string;
  body: string;
  kind: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      toast.error("No se pudieron cargar las notificaciones");
    }
    setItems((data ?? []) as Notif[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unread = items.filter((i) => !i.read).length;

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    load();
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    load();
  };

  const sendTestNotification = async () => {
    if (!user) return;
    const { error } = await supabase.from("notifications").insert({
      user_id: user.id,
      title: "Notificación de prueba",
      body: "¡Funciona! Aquí verás los recordatorios de tu calendario tributario cuando un vencimiento esté a 3 o 1 día.",
      kind: "info",
      link: "/calendar",
    });
    if (error) {
      toast.error("Error al enviar prueba: " + error.message);
    } else {
      toast.success("Notificación de prueba enviada");
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md border border-white/10 bg-white/5 p-2 text-muted-foreground transition hover:border-[oklch(0.7_0.22_245/0.5)] hover:text-neon"
        title="Notificaciones"
        aria-label={`Notificaciones${unread > 0 ? ` (${unread} sin leer)` : ""}`}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[oklch(0.92_0.2_105)] px-1 font-mono text-[9px] font-bold text-[oklch(0.12_0.02_260)] animate-pulse">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm sm:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="glass fixed inset-x-3 top-20 z-50 max-h-[80vh] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/95 p-0 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[360px] sm:max-h-[520px]">
            <div className="flex items-center justify-between border-b border-white/15 px-4 py-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Notificaciones
                </div>
                {unread > 0 && (
                  <div className="mt-1 text-sm font-semibold text-slate-100">{unread} sin leer</div>
                )}
              </div>
              <div className="flex gap-1">
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
                    title="Marcar todas como leídas"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-slate-100"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto sm:max-h-[420px]">
              {loading ? (
                <div className="px-5 py-10 text-center text-sm text-slate-400">Cargando…</div>
              ) : items.length === 0 ? (
                <div className="space-y-4 px-5 py-7 text-center">
                  <BellRing className="mx-auto h-10 w-10 text-slate-500" />
                  <div className="text-sm font-semibold text-slate-100">No tienes notificaciones todavía.</div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-4 text-left">
                    <div className="text-sm font-semibold text-neon">¿Cómo recibo notificaciones?</div>
                    <ol className="mt-2 space-y-1 pl-4 text-sm text-slate-300">
                      <li>1. Ve al Calendario Tributario</li>
                      <li>2. Activa la campanita 🔔 en una obligación</li>
                      <li>3. Recibirás aviso 3 y 1 día antes del vencimiento</li>
                    </ol>
                  </div>
                  <button
                    onClick={sendTestNotification}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-2 text-sm font-semibold text-neon transition hover:bg-slate-800"
                  >
                    <Sparkles className="h-4 w-4" /> Probar notificación
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-white/10">
                  {items.map((n) => {
                    const tone =
                      n.kind === "danger"
                        ? "text-rose-400"
                        : n.kind === "warning"
                          ? "text-amber-300"
                          : "text-cyan-300";
                    return (
                      <li
                        key={n.id}
                        className={`px-5 py-4 transition ${!n.read ? "bg-slate-900/80" : "bg-slate-950/90"} hover:bg-slate-900/95`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${!n.read ? "bg-cyan-300" : "bg-slate-700"}`} />
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm font-semibold ${tone}`}>{n.title}</div>
                            <div className="mt-1 text-sm leading-6 text-slate-300">{n.body}</div>
                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span className="font-mono">{new Date(n.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}</span>
                              {n.link && (
                                <Link
                                  to={n.link as "/calendar"}
                                  onClick={() => {
                                    markRead(n.id);
                                    setOpen(false);
                                  }}
                                  className="font-mono uppercase tracking-[0.18em] text-cyan-300 transition hover:text-cyan-200"
                                >
                                  Ver →
                                </Link>
                              )}
                              {!n.read && (
                                <button
                                  onClick={() => markRead(n.id)}
                                  className="font-mono uppercase tracking-[0.18em] text-slate-400 transition hover:text-slate-200"
                                >
                                  Marcar leída
                                </button>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => remove(n.id)}
                            className="text-slate-500 transition hover:text-rose-400"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
