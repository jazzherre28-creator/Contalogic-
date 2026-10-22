import { Link, useLocation } from "@tanstack/react-router";
import {
  Activity,
  Calculator,
  ScanLine,
  Sparkles,
  LogOut,
  User,
  Crown,
  CalendarDays,
  BookOpen,
  BookMarked,
  MoreHorizontal,
  TrendingDown,
  Truck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/hooks/use-roles";
import { ENTITY_LABEL, SECTOR_LABEL } from "@/lib/sectors";
import { NotificationBell } from "@/components/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PRIMARY = [
  { to: "/dashboard", label: "Dashboard", icon: Activity },
  { to: "/calculator", label: "Calculadora", icon: Calculator },
  { to: "/scanner", label: "Escáner OCR", icon: ScanLine },
  { to: "/lex-ai", label: "LEX AI", icon: Sparkles },
] as const;

const MORE = [
  {
    to: "/tax-savings",
    label: "Ahorro de impuestos",
    desc: "Estrategias y deducciones",
    icon: TrendingDown,
  },
  {
    to: "/calendar",
    label: "Calendario DIAN",
    desc: "Vencimientos tributarios",
    icon: CalendarDays,
  },
  {
    to: "/dictionary",
    label: "Diccionario tributario",
    desc: "Términos del Estatuto",
    icon: BookOpen,
  },
  { to: "/manual", label: "Manual de usuario", desc: "Guía de la terminal", icon: BookMarked },
] as const;

export function AppHeader() {
  const { profile, signOut } = useAuth();
  const { isSuperAdmin } = useRoles();
  const loc = useLocation();

  const moreActive = MORE.some((m) => loc.pathname === m.to);

  return (
    <header className="glass mx-3 mt-3 px-4 py-3 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="relative">
            <div className="h-9 w-9 rounded-md bg-[var(--gradient-neon)] pulse-neon" />
            <div className="absolute inset-0 grid place-items-center text-[10px] font-bold text-[oklch(0.12_0.02_260)]">
              C+
            </div>
          </div>
          <div className="leading-tight">
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
              Contalogic AI+
            </div>
            <div className="text-sm font-semibold text-neon">Terminal Financiera Universal</div>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-1.5">
          {PRIMARY.map(({ to, label, icon: Icon }) => {
            const active = loc.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-[oklch(0.7_0.22_245/0.12)] text-neon shadow-[inset_0_0_0_1px_oklch(0.7_0.22_245/0.45)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}

          {profile?.sector === "transporte" && (
            <Link
              to="/calcutrans"
              aria-label="CalcuTrans"
              title="CalcuTrans"
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
                loc.pathname === "/calcutrans"
                  ? "bg-[oklch(0.7_0.22_245/0.12)] text-neon shadow-[inset_0_0_0_1px_oklch(0.7_0.22_245/0.45)]"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">CalcuTrans</span>
            </Link>
          )}

          {/* Menú Más — portal sólido para legibilidad */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition outline-none ${
                  moreActive
                    ? "bg-[oklch(0.7_0.22_245/0.12)] text-neon shadow-[inset_0_0_0_1px_oklch(0.7_0.22_245/0.45)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Más</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="z-[200] min-w-[260px] border border-white/20 bg-[oklch(0.11_0.025_260/0.98)] p-1.5 text-slate-100 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.85)] backdrop-blur-xl"
            >
              <DropdownMenuLabel className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Herramientas
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              {MORE.map(({ to, label, desc, icon: Icon }) => {
                const active = loc.pathname === to;
                return (
                  <DropdownMenuItem
                    key={to}
                    asChild
                    className="cursor-pointer rounded-md p-0 focus:bg-[oklch(0.7_0.22_245/0.15)]"
                  >
                    <Link
                      to={to}
                      className={`flex w-full items-start gap-3 px-3 py-2.5 ${
                        active ? "bg-[oklch(0.7_0.22_245/0.12)] text-neon" : "text-slate-100"
                      }`}
                    >
                      <Icon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-neon" : "text-slate-400"}`}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-tight">{label}</div>
                        <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{desc}</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {isSuperAdmin && (
            <Link
              to="/admin"
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
                loc.pathname === "/admin"
                  ? "bg-[oklch(0.92_0.2_105/0.15)] text-emerald-glow shadow-[inset_0_0_0_1px_oklch(0.92_0.2_105/0.55)]"
                  : "text-emerald-glow/80 hover:text-emerald-glow hover:bg-[oklch(0.92_0.2_105/0.08)]"
              }`}
              title="Consola Maestra"
            >
              <Crown className="h-4 w-4" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <NotificationBell />
          {profile?.entity_type && profile.sector && (
            <div className="hidden flex-col items-end text-right md:flex">
              <span className="chip chip-neon">
                <User className="h-3 w-3" />
                {ENTITY_LABEL[profile.entity_type]}
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {SECTOR_LABEL[profile.sector]}
              </span>
            </div>
          )}
          <button onClick={signOut} className="btn-neon !px-2.5 !py-2" title="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
