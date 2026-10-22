import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  CalendarDays,
  BellRing,
  Filter,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { SECTOR_LABEL, ENTITY_LABEL } from "@/lib/sectors";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
});

type Deadline = {
  id: string;
  obligation: string;
  entity_type: string;
  sector: string;
  period: string;
  due_date: string;
  nit_last_digit: number | null;
  nit_group: string | null;
  description: string | null;
  estatuto_article: string | null;
};

type Reminder = { id: string; deadline_id: string; status: string };

function daysUntil(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

function CalendarPage() {
  const { user, profile } = useAuth();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterMine, setFilterMine] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: dls, error: deadlinesError }, { data: rems, error: remindersError }] =
      await Promise.all([
        supabase.from("tax_deadlines").select("*").order("due_date", { ascending: true }),
        user
          ? supabase.from("user_reminders").select("id, deadline_id, status").eq("user_id", user.id)
          : Promise.resolve({ data: [] as Reminder[], error: null }),
      ]);
    if (deadlinesError || remindersError) {
      const error = deadlinesError ?? remindersError;
      console.error("No se pudo cargar el calendario tributario", error);
      setLoadError("No fue posible cargar los vencimientos. Intenta nuevamente.");
    } else {
      setLoadError(null);
    }
    setDeadlines((dls ?? []) as Deadline[]);
    setReminders((rems ?? []) as Reminder[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const filtered = useMemo(() => {
    if (!filterMine || !profile) return deadlines;
    return deadlines.filter((d) => {
      const matchSector = d.sector === "todos" || d.sector === profile.sector;
      const matchEntity = d.entity_type === "ambas" || d.entity_type === profile.entity_type;
      const matchNit =
        d.nit_last_digit === null ||
        profile.nit_last_digit === null ||
        profile.nit_last_digit === undefined ||
        d.nit_last_digit === profile.nit_last_digit;
      return matchSector && matchEntity && matchNit;
    });
  }, [deadlines, filterMine, profile]);

  const reminderMap = useMemo(() => {
    const m = new Map<string, Reminder>();
    reminders.forEach((r) => m.set(r.deadline_id, r));
    return m;
  }, [reminders]);

  const toggleReminder = async (deadlineId: string) => {
    if (!user) return;
    const existing = reminderMap.get(deadlineId);
    if (existing) {
      await supabase.from("user_reminders").delete().eq("id", existing.id);
      toast.success("Recordatorio eliminado");
    } else {
      const { error } = await supabase
        .from("user_reminders")
        .insert({ user_id: user.id, deadline_id: deadlineId, status: "pending" });
      if (error) toast.error(error.message);
      else toast.success("Recordatorio activado · Te avisaremos");
    }
    load();
  };

  const upcoming = filtered.filter((d) => daysUntil(d.due_date) >= 0);
  const overdue = filtered.filter((d) => daysUntil(d.due_date) < 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass-neon p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="chip chip-neon">
              <CalendarDays className="h-3 w-3" /> CALENDARIO TRIBUTARIO DIAN 2026
            </span>
            <h1 className="mt-2 text-xl font-bold sm:text-2xl">Vencimientos fiscales</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Filtrado por {profile && ENTITY_LABEL[profile.entity_type ?? "natural"]} ·{" "}
              {profile && SECTOR_LABEL[profile.sector ?? "transporte"]}
              {profile?.nit_last_digit !== null && profile?.nit_last_digit !== undefined && (
                <>
                  {" "}
                  · NIT terminado en{" "}
                  <span className="text-neon font-mono">{profile.nit_last_digit}</span>
                </>
              )}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Para renta de personas naturales, verifica los dos últimos dígitos del NIT y el grupo
              indicado en cada vencimiento. Fechas tomadas del calendario oficial DIAN 2026.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://www.dian.gov.co/Calendarios/Calendario_Tributario_2026.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-2 text-xs text-muted-foreground transition hover:border-neon/40 hover:text-neon"
            >
              Fuente DIAN <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              onClick={() => setFilterMine((v) => !v)}
              className={`btn-neon ${!filterMine ? "!bg-transparent !text-muted-foreground" : ""}`}
            >
              <Filter className="h-4 w-4" />
              {filterMine ? "Filtrado: Mi perfil" : "Mostrar todos"}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-neon" />
        </div>
      ) : loadError ? (
        <div role="alert" className="glass px-5 py-8 text-center text-sm text-destructive">
          <p>{loadError}</p>
          <button onClick={load} className="mt-3 underline underline-offset-4">
            Reintentar
          </button>
        </div>
      ) : deadlines.length === 0 ? (
        <div className="glass px-5 py-8 text-center text-sm text-muted-foreground">
          No hay vencimientos cargados. Consulta el calendario oficial DIAN enlazado arriba.
        </div>
      ) : (
        <>
          {overdue.length > 0 && (
            <Section title="Vencidos" icon={AlertTriangle} accent="destructive">
              {overdue.map((d) => (
                <DeadlineRow
                  key={d.id}
                  d={d}
                  reminded={reminderMap.has(d.id)}
                  onToggle={() => toggleReminder(d.id)}
                />
              ))}
            </Section>
          )}

          <Section
            title={`Próximos vencimientos (${upcoming.length})`}
            icon={CalendarDays}
            accent="neon"
          >
            {upcoming.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                No hay vencimientos próximos para tu perfil. Cambia el filtro para ver todos.
              </div>
            ) : (
              upcoming.map((d) => (
                <DeadlineRow
                  key={d.id}
                  d={d}
                  reminded={reminderMap.has(d.id)}
                  onToggle={() => toggleReminder(d.id)}
                />
              ))
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  icon: typeof CalendarDays;
  accent: "neon" | "destructive";
  children: React.ReactNode;
}) {
  return (
    <div className="glass overflow-hidden">
      <div
        className={`flex items-center gap-2 border-b border-white/10 px-5 py-3 ${
          accent === "destructive" ? "text-destructive" : "text-neon"
        }`}
      >
        <Icon className="h-4 w-4" />
        <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  );
}

function DeadlineRow({
  d,
  reminded,
  onToggle,
}: {
  d: Deadline;
  reminded: boolean;
  onToggle: () => void;
}) {
  const days = daysUntil(d.due_date);
  const urgent = days >= 0 && days <= 7;
  const overdue = days < 0;

  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{d.obligation}</span>
          <span className="chip">{d.period}</span>
          {d.nit_last_digit !== null && (
            <span className="chip chip-neon font-mono">NIT •{d.nit_last_digit}</span>
          )}
          {d.nit_group && <span className="chip chip-neon font-mono">NIT {d.nit_group}</span>}
        </div>
        {d.description && <p className="mt-1 text-xs text-muted-foreground">{d.description}</p>}
        {d.estatuto_article && (
          <div className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-emerald-glow">
            <BookOpen className="h-3 w-3" /> {d.estatuto_article}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="font-mono text-sm">
            {new Date(d.due_date + "T00:00:00").toLocaleDateString("es-CO", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </div>
          <div
            className={`font-mono text-[10px] uppercase tracking-widest ${
              overdue ? "text-destructive" : urgent ? "text-emerald-glow" : "text-muted-foreground"
            }`}
          >
            {overdue ? `Vencido hace ${Math.abs(days)} días` : `En ${days} días`}
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`rounded-md border p-2 transition ${
            reminded
              ? "border-[oklch(0.92_0.2_105/0.5)] bg-[oklch(0.92_0.2_105/0.12)] text-emerald-glow"
              : "border-white/10 text-muted-foreground hover:border-white/30 hover:text-foreground"
          }`}
          title={reminded ? "Quitar recordatorio" : "Activar recordatorio"}
        >
          {reminded ? <CheckCircle2 className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
