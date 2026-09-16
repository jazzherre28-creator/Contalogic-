import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Gavel,
  Landmark,
  Lightbulb,
  Scale,
  Shield,
  Sparkles,
  ScanLine,
  Activity,
  Clock,
  CircleDot,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ENTITY_LABEL, SECTOR_LABEL } from "@/lib/sectors";
import {
  CATEGORY_LABEL,
  DIDACTIC_TIPS,
  PRIORITY_LABEL,
  TAX_REFORMS,
  daysUntil,
  filterRemindersForEntity,
  sortByUrgency,
  type ReminderCategory,
  type ReminderPriority,
  type TaxReminder,
} from "@/lib/tax-reminders";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

const SLIDES = [
  { id: "inicio", label: "Inicio", icon: Bell, hint: "Resumen y accesos rápidos" },
  { id: "urgentes", label: "Urgentes", icon: AlertTriangle, hint: "Lo que vence pronto" },
  { id: "dian", label: "DIAN", icon: Landmark, hint: "Trámites y cumplimiento" },
  { id: "pagos", label: "Pagos", icon: FileText, hint: "IVA, PILA, retenciones" },
  { id: "reportes", label: "Reportes", icon: BookOpen, hint: "Declaraciones y exógena" },
  { id: "reformas", label: "Reformas", icon: Gavel, hint: "Normativa vigente 2026" },
  { id: "guia", label: "Guía", icon: Lightbulb, hint: "Consejos prácticos" },
] as const;

const CATEGORY_ICONS: Record<ReminderCategory, typeof Landmark> = {
  dian: Landmark,
  pagos: FileText,
  reportes: BookOpen,
  pendiente: AlertTriangle,
};

const TIP_ICONS = {
  lightbulb: Lightbulb,
  shield: Shield,
  calendar: CalendarClock,
  book: BookOpen,
};

const PRIORITY_STYLES: Record<
  ReminderPriority,
  { border: string; badge: string; dot: string }
> = {
  urgent: {
    border: "border-rose-500/40",
    badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    dot: "bg-rose-500 animate-pulse",
  },
  soon: {
    border: "border-amber-500/35",
    badge: "bg-amber-500/12 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400",
  },
  upcoming: {
    border: "border-[oklch(0.7_0.22_245/0.35)]",
    badge: "bg-[oklch(0.7_0.22_245/0.12)] text-neon border-[oklch(0.7_0.22_245/0.3)]",
    dot: "bg-neon",
  },
  info: {
    border: "border-white/10",
    badge: "bg-white/5 text-muted-foreground border-white/10",
    dot: "bg-muted-foreground",
  },
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso + "T12:00:00"));
}

function CountdownBadge({ days }: { days: number }) {
  if (days < 0)
    return (
      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
        Vencido
      </span>
    );
  if (days === 0)
    return (
      <span className="rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-400">
        Hoy
      </span>
    );
  if (days <= 7)
    return (
      <span className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-rose-300">
        {days}d
      </span>
    );
  return (
    <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
      {days}d
    </span>
  );
}

function ReminderCard({ reminder, compact }: { reminder: TaxReminder; compact?: boolean }) {
  const days = daysUntil(reminder.dueDate);
  const styles = PRIORITY_STYLES[reminder.priority];
  const CatIcon = CATEGORY_ICONS[reminder.category];

  return (
    <article
      className={cn(
        "glass rounded-xl border p-4",
        styles.border,
        compact && "p-3",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className={cn("h-2 w-2 rounded-full", styles.dot)} />
          <span className={cn("rounded-md border px-2 py-0.5 font-mono text-[9px] uppercase", styles.badge)}>
            {PRIORITY_LABEL[reminder.priority]}
          </span>
          <span className="chip !py-0.5 !text-[9px]">
            <CatIcon className="h-2.5 w-2.5" />
            {CATEGORY_LABEL[reminder.category]}
          </span>
        </div>
        <CountdownBadge days={days} />
      </div>

      <h3 className={cn("mt-2 font-semibold leading-snug", compact ? "text-xs" : "text-sm")}>
        {reminder.title}
      </h3>
      {!compact && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{reminder.description}</p>
      )}

      <div className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
        <CalendarClock className="h-3 w-3 text-neon" />
        {formatDate(reminder.dueDate)}
      </div>

      {reminder.tip && !compact && (
        <div className="mt-2 flex gap-2 rounded-lg border border-[oklch(0.92_0.2_105/0.2)] bg-[oklch(0.92_0.2_105/0.06)] p-2">
          <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-emerald-glow" />
          <p className="text-[11px] leading-relaxed text-emerald-glow/90">{reminder.tip}</p>
        </div>
      )}

      {reminder.link && (
        <a
          href={reminder.link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-neon hover:underline"
        >
          {reminder.linkLabel ?? "Ver en DIAN"}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </article>
  );
}

function SlideHeader({
  step,
  title,
  subtitle,
}: {
  step: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Paso {step} de {SLIDES.length}
      </div>
      <h2 className="mt-1 text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function QuickActions({ entityType }: { entityType?: string | null }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <QuickAction to="/calculator" icon={Activity} title="Calculadora" desc="Ingresos y egresos" />
      <QuickAction to="/scanner" icon={ScanLine} title="Escáner OCR" desc="Balance y P&L" />
      <QuickAction
        to="/lex-ai"
        icon={Sparkles}
        title="LEX AI"
        desc={entityType === "juridica" ? "Art. 107 ET" : "RST y deducciones"}
      />
    </div>
  );
}

export function TaxRemindersBoard() {
  const { profile } = useAuth();
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  const reminders = useMemo(
    () => sortByUrgency(filterRemindersForEntity(profile?.entity_type)),
    [profile?.entity_type],
  );

  const urgent = reminders.filter((r) => r.priority === "urgent" || r.priority === "soon");
  const byCategory = (cat: ReminderCategory) => reminders.filter((r) => r.category === cat);
  const nextDeadline = reminders.find((r) => daysUntil(r.dueDate) >= 0);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  const goTo = useCallback(
    (index: number) => {
      api?.scrollTo(index);
    },
    [api],
  );

  return (
    <div className="space-y-3">
      {/* Nav pills */}
      <div className="glass flex gap-1 overflow-x-auto rounded-xl p-1.5 scrollbar-none">
        {SLIDES.map((slide, i) => {
          const Icon = slide.icon;
          const active = current === i;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => goTo(i)}
              title={slide.hint}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition",
                active
                  ? "bg-[oklch(0.7_0.22_245/0.15)] text-neon ring-1 ring-[oklch(0.7_0.22_245/0.4)]"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{slide.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main carousel */}
      <div className="relative">
        <Carousel setApi={setApi} opts={{ align: "start", loop: false }} className="w-full">
          <CarouselContent className="-ml-2">
            {/* 1 · Inicio */}
            <CarouselItem className="pl-2">
              <div className="glass-neon scanline min-h-[420px] rounded-xl p-5 sm:p-6">
                <SlideHeader
                  step={1}
                  title={`Hola, ${profile?.display_name ?? "contribuyente"}`}
                  subtitle="Tu centro de control tributario — desliza o usa las pestañas para ver cada sección."
                />

                <div className="mb-4 flex flex-wrap gap-2">
                  {profile?.entity_type && (
                    <span className="chip chip-neon">{ENTITY_LABEL[profile.entity_type]}</span>
                  )}
                  {profile?.sector && <span className="chip">{SECTOR_LABEL[profile.sector]}</span>}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {nextDeadline && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/8 p-4">
                      <div className="font-mono text-[9px] uppercase tracking-widest text-rose-400">
                        Próximo vencimiento
                      </div>
                      <div className="mt-1 text-4xl font-bold tabular-nums text-rose-300">
                        {daysUntil(nextDeadline.dueDate)}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">días</span>
                      </div>
                      <p className="mt-2 text-xs font-medium leading-snug">{nextDeadline.title}</p>
                      <button
                        type="button"
                        onClick={() => goTo(1)}
                        className="mt-3 text-[11px] font-semibold text-rose-300 hover:underline"
                      >
                        Ver urgentes →
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat label="Urgentes" value={urgent.length} tone="rose" />
                    <MiniStat label="Total" value={reminders.length} tone="neon" />
                    <MiniStat label="DIAN" value={byCategory("dian").length} tone="neon" />
                    <MiniStat label="Reformas" value={TAX_REFORMS.length} tone="emerald" />
                  </div>
                </div>

                <div className="mt-5">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Acciones rápidas
                  </p>
                  <QuickActions entityType={profile?.entity_type} />
                </div>
              </div>
            </CarouselItem>

            {/* 2 · Urgentes */}
            <CarouselItem className="pl-2">
              <div className="glass min-h-[420px] rounded-xl p-5 sm:p-6">
                <SlideHeader
                  step={2}
                  title="Obligaciones urgentes y próximas"
                  subtitle="Prioriza estos vencimientos antes de continuar con el resto del mes."
                />

                {urgent.length === 0 ? (
                  <EmptyState text="No tienes vencimientos urgentes. Revisa DIAN y pagos en las siguientes secciones." />
                ) : (
                  <div className="space-y-3">
                    {urgent.map((r) => (
                      <ReminderCard key={r.id} reminder={r} />
                    ))}
                  </div>
                )}

                {urgent.length > 0 && (
                  <div className="mt-4 rounded-lg border border-[oklch(0.92_0.2_105/0.25)] bg-[oklch(0.92_0.2_105/0.06)] p-3">
                    <p className="text-xs text-emerald-glow/90">
                      <strong>Qué hacer hoy:</strong> verifica tu calendario DIAN según el último dígito del NIT,
                      prepara formularios 300/350 y consigna PILA si tienes empleados.
                    </p>
                  </div>
                )}
              </div>
            </CarouselItem>

            {/* 3 · DIAN */}
            <CarouselItem className="pl-2">
              <div className="glass min-h-[420px] rounded-xl p-5 sm:p-6">
                <SlideHeader
                  step={3}
                  title="Trámites DIAN"
                  subtitle="RUT, facturación electrónica y obligaciones formales ante la DIAN."
                />
                <ReminderList items={byCategory("dian")} empty="Sin recordatorios DIAN para tu régimen." />
              </div>
            </CarouselItem>

            {/* 4 · Pagos */}
            <CarouselItem className="pl-2">
              <div className="glass min-h-[420px] rounded-xl p-5 sm:p-6">
                <SlideHeader
                  step={4}
                  title="Pagos e impuestos"
                  subtitle="IVA bimestral, retenciones, ICA, PILA y RST según tu tipo de contribuyente."
                />
                <ReminderList
                  items={[...byCategory("pagos"), ...byCategory("pendiente")]}
                  empty="Sin pagos pendientes registrados."
                />
              </div>
            </CarouselItem>

            {/* 5 · Reportes */}
            <CarouselItem className="pl-2">
              <div className="glass min-h-[420px] rounded-xl p-5 sm:p-6">
                <SlideHeader
                  step={5}
                  title="Reportes y declaraciones"
                  subtitle="Exógena, medios magnéticos, renta anual y libros contables."
                />
                <ReminderList items={byCategory("reportes")} empty="Sin reportes próximos." />
              </div>
            </CarouselItem>

            {/* 6 · Reformas */}
            <CarouselItem className="pl-2">
              <div className="glass min-h-[420px] rounded-xl p-5 sm:p-6">
                <SlideHeader
                  step={6}
                  title="Reformas tributarias vigentes"
                  subtitle="Normas que impactan tu negocio en 2026 — conoce las más relevantes."
                />
                <div className="space-y-3">
                  {TAX_REFORMS.map((reform) => (
                    <article
                      key={reform.id}
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Gavel className="h-4 w-4 text-neon" />
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 font-mono text-[9px] uppercase",
                            reform.impact === "alto"
                              ? "border-rose-500/25 bg-rose-500/10 text-rose-400"
                              : reform.impact === "medio"
                                ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
                                : "border-[oklch(0.92_0.2_105/0.3)] bg-[oklch(0.92_0.2_105/0.08)] text-emerald-glow",
                          )}
                        >
                          Impacto {reform.impact}
                        </span>
                        {reform.tags.slice(0, 2).map((t) => (
                          <span key={t} className="chip !py-0.5 !text-[9px]">
                            {t}
                          </span>
                        ))}
                      </div>
                      <h3 className="mt-2 text-sm font-semibold">{reform.title}</h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{reform.summary}</p>
                    </article>
                  ))}
                </div>
              </div>
            </CarouselItem>

            {/* 7 · Guía */}
            <CarouselItem className="pl-2">
              <div className="glass min-h-[420px] rounded-xl p-5 sm:p-6">
                <SlideHeader
                  step={7}
                  title="Guía práctica tributaria"
                  subtitle="Consejos para cumplir, ahorrar y evitar sanciones."
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  {DIDACTIC_TIPS.map((tip) => {
                    const TipIcon = TIP_ICONS[tip.icon];
                    return (
                      <div key={tip.id} className="rounded-xl border border-white/10 p-4">
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg border border-[oklch(0.92_0.2_105/0.25)] bg-[oklch(0.92_0.2_105/0.08)] p-2 text-emerald-glow">
                            <TipIcon className="h-4 w-4" />
                          </div>
                          <h3 className="text-xs font-semibold">{tip.title}</h3>
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{tip.body}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Herramientas
                  </p>
                  <QuickActions entityType={profile?.entity_type} />
                </div>

                <p className="mt-4 text-center font-mono text-[10px] text-muted-foreground/70">
                  Información orientativa · Confirma fechas en el calendario DIAN según tu NIT
                </p>
              </div>
            </CarouselItem>
          </CarouselContent>
        </Carousel>

        {/* Carousel controls */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => api?.scrollPrev()}
            disabled={current === 0}
            className="glass flex h-9 w-9 items-center justify-center rounded-lg transition hover:border-neon/40 disabled:opacity-30"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex flex-1 items-center justify-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ir a ${SLIDES[i].label}`}
                className={cn(
                  "h-2 rounded-full transition-all",
                  current === i ? "w-6 bg-neon" : "w-2 bg-white/20 hover:bg-white/40",
                )}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => api?.scrollNext()}
            disabled={current === SLIDES.length - 1}
            className="glass flex h-9 w-9 items-center justify-center rounded-lg transition hover:border-neon/40 disabled:opacity-30"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          <CircleDot className="mr-1 inline h-3 w-3 text-neon" />
          {SLIDES[current]?.hint}
        </p>
      </div>
    </div>
  );
}

function ReminderList({ items, empty }: { items: TaxReminder[]; empty: string }) {
  if (items.length === 0) return <EmptyState text={empty} />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((r) => (
        <ReminderCard key={r.id} reminder={r} />
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid h-48 place-items-center rounded-xl border border-dashed border-white/10 px-4 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "rose" | "neon" | "emerald";
}) {
  const styles = {
    rose: { text: "text-rose-400", box: "border-rose-500/20 bg-rose-500/8" },
    neon: { text: "text-neon", box: "border-[oklch(0.7_0.22_245/0.25)] bg-[oklch(0.7_0.22_245/0.08)]" },
    emerald: { text: "text-emerald-glow", box: "border-[oklch(0.92_0.2_105/0.25)] bg-[oklch(0.92_0.2_105/0.08)]" },
  }[tone];

  return (
    <div className={cn("rounded-lg border p-3", styles.box)}>
      <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-bold tabular-nums", styles.text)}>{value}</div>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: "/calculator" | "/scanner" | "/lex-ai";
  icon: typeof Activity;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="glass group flex items-center gap-3 rounded-xl p-3 transition hover:border-[oklch(0.7_0.22_245/0.4)]"
    >
      <div className="rounded-md border border-white/10 bg-[oklch(0.7_0.22_245/0.1)] p-2 text-neon">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold">{title}</div>
        <div className="truncate text-[10px] text-muted-foreground">{desc}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-neon" />
    </Link>
  );
}
