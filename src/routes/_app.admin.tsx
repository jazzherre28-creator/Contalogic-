import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRoles } from "@/hooks/use-roles";
import { ENTITY_LABEL, SECTOR_LABEL } from "@/lib/sectors";
import {
  Crown,
  Users,
  Activity,
  ScanLine,
  Shield,
  ShieldOff,
  Search,
  Loader2,
  AlertTriangle,
  Trash2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Sparkles,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { TerminalPreview } from "@/components/TerminalPreview";

export const Route = createFileRoute("/_app/admin")({
  component: AdminConsole,
});

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
  profile: {
    display_name: string | null;
    entity_type: string | null;
    sector: string | null;
    onboarded: boolean;
  } | null;
  roles: ("super_admin" | "admin" | "user")[];
  stats: { income: number; expense: number; records: number; docs: number };
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

const SUPPORT_EMAIL = "jazzherre28@gmail.com";

function AdminConsole() {
  const { user: me } = useAuth();
  const { isSuperAdmin, loading: rolesLoading } = useRoles();
  const nav = useNavigate();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "admins" | "onboarded" | "pending">("all");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (rolesLoading) return;
    if (!isSuperAdmin) {
      toast.error("Acceso restringido a super administradores");
      nav({ to: "/dashboard" });
    }
  }, [isSuperAdmin, rolesLoading, nav]);

  const callAdmin = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body,
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await callAdmin({ action: "list" });
      setUsers(data.users ?? []);
    } catch (e) {
      toast.error("Error cargando usuarios", {
        description: (e as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const grant = async (userId: string, role: "admin" | "super_admin") => {
    setBusy(userId + role);
    try {
      await callAdmin({ action: "grant_role", user_id: userId, role });
      toast.success(`Rol ${role} otorgado`);
      await load();
    } catch (e) {
      toast.error("No se pudo otorgar el rol", {
        description: (e as Error).message,
      });
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (userId: string, role: "admin" | "super_admin") => {
    if (
      users
        .find((adminUser) => adminUser.id === userId)
        ?.email?.trim()
        .toLowerCase() === SUPPORT_EMAIL
    ) {
      toast.error("La cuenta de soporte está protegida y no puede perder sus roles.");
      return;
    }
    setBusy(userId + role);
    try {
      await callAdmin({ action: "revoke_role", user_id: userId, role });
      toast.success(`Rol ${role} revocado`);
      await load();
    } catch (e) {
      toast.error("No se pudo revocar el rol", {
        description: (e as Error).message,
      });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (u: AdminUser) => {
    if (u.email?.trim().toLowerCase() === SUPPORT_EMAIL) {
      toast.error("La cuenta de soporte está protegida y no se puede eliminar.");
      return;
    }
    if (!confirm(`¿Eliminar permanentemente a ${u.email}? Esta acción borra TODOS sus datos.`))
      return;
    setBusy(u.id + "del");
    try {
      await callAdmin({ action: "delete_user", user_id: u.id });
      toast.success("Usuario eliminado");
      await load();
    } catch (e) {
      toast.error("No se pudo eliminar", {
        description: (e as Error).message,
      });
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (q) {
        const hay = `${u.email ?? ""} ${u.profile?.display_name ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (filter === "admins") return u.roles.some((r) => r === "admin" || r === "super_admin");
      if (filter === "onboarded") return u.profile?.onboarded;
      if (filter === "pending") return !u.profile?.onboarded;
      return true;
    });
  }, [users, q, filter]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) =>
      u.roles.some((r) => r === "admin" || r === "super_admin"),
    ).length;
    const onboarded = users.filter((u) => u.profile?.onboarded).length;
    const totalIncome = users.reduce((s, u) => s + u.stats.income, 0);
    const totalExpense = users.reduce((s, u) => s + u.stats.expense, 0);
    const totalRecords = users.reduce((s, u) => s + u.stats.records, 0);
    const totalDocs = users.reduce((s, u) => s + u.stats.docs, 0);
    return {
      total,
      admins,
      onboarded,
      totalIncome,
      totalExpense,
      totalRecords,
      totalDocs,
    };
  }, [users]);

  if (rolesLoading || !isSuperAdmin) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-glow" />
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      {/* glow orbs */}
      <div
        className="glow-orb"
        style={{
          background: "var(--gradient-emerald)",
          width: 320,
          height: 320,
          top: -80,
          right: -60,
        }}
      />
      <div
        className="glow-orb"
        style={{
          background: "var(--gradient-neon)",
          width: 280,
          height: 280,
          bottom: -100,
          left: -40,
          opacity: 0.35,
        }}
      />

      {/* Header bar */}
      <div className="glass-neon scanline relative overflow-hidden p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--gradient-emerald)] shadow-[var(--shadow-emerald)]">
                <Crown className="h-6 w-6 text-[oklch(0.12_0.02_260)]" />
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-glow">
                  Mano Maestra · Acceso Total
                </div>
                <h1 className="text-2xl font-bold sm:text-3xl">
                  <span className="text-emerald-glow">CONSOLA</span>{" "}
                  <span className="text-neon">SUPER ADMIN</span>
                </h1>
              </div>
            </div>
            <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
              Visualiza todos los terminales, gestiona roles, audita la actividad financiera global
              y controla el acceso al sistema.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start">
            <button
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-[oklch(0.92_0.2_105/0.5)] bg-[oklch(0.92_0.2_105/0.1)] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-glow transition hover:bg-[oklch(0.92_0.2_105/0.18)] hover:shadow-[0_0_20px_-4px_oklch(0.92_0.2_105/0.6)]"
              title="Visualizar todos los terminales"
            >
              <Eye className="h-4 w-4" />
              Super Ojito
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="btn-emerald inline-flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      <TerminalPreview open={previewOpen} onClose={() => setPreviewOpen(false)} />

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Usuarios totales"
          value={stats.total.toString()}
          tone="neon"
        />
        <StatCard
          icon={<Shield className="h-5 w-5" />}
          label="Administradores"
          value={stats.admins.toString()}
          tone="emerald"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Onboarded"
          value={`${stats.onboarded}/${stats.total}`}
          tone="neon"
        />
        <StatCard
          icon={<ScanLine className="h-5 w-5" />}
          label="Documentos OCR"
          value={stats.totalDocs.toString()}
          tone="emerald"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Ingresos globales"
          value={fmt(stats.totalIncome)}
          tone="emerald"
          wide
        />
        <StatCard
          icon={<TrendingDown className="h-5 w-5" />}
          label="Gastos globales"
          value={fmt(stats.totalExpense)}
          tone="neon"
          wide
        />
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label="Transacciones"
          value={stats.totalRecords.toString()}
          tone="neon"
          wide
        />
        <StatCard
          icon={<Sparkles className="h-5 w-5" />}
          label="Margen neto"
          value={fmt(stats.totalIncome - stats.totalExpense)}
          tone={stats.totalIncome - stats.totalExpense >= 0 ? "emerald" : "neon"}
          wide
        />
      </div>

      {/* Filters */}
      <div className="glass flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por correo o nombre…"
            className="input-neon !pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Todos"],
              ["admins", "Admins"],
              ["onboarded", "Activos"],
              ["pending", "Pendientes"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition ${
                filter === key
                  ? "bg-[oklch(0.92_0.2_105/0.18)] text-emerald-glow shadow-[inset_0_0_0_1px_oklch(0.92_0.2_105/0.5)]"
                  : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Users grid */}
      {loading ? (
        <div className="glass grid place-items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-glow" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass grid place-items-center py-20 text-sm text-muted-foreground">
          Sin resultados
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((u) => (
            <UserCard
              key={u.id}
              u={u}
              isMe={u.id === me?.id}
              isSupport={u.email?.trim().toLowerCase() === SUPPORT_EMAIL}
              busy={busy}
              onGrant={grant}
              onRevoke={revoke}
              onDelete={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
  wide,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "neon" | "emerald";
  wide?: boolean;
}) {
  return (
    <div
      className={`glass relative overflow-hidden p-4 ${wide ? "sm:col-span-2 lg:col-span-1" : ""}`}
    >
      <div
        className={`absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-25 blur-2xl ${
          tone === "emerald" ? "bg-[var(--gradient-emerald)]" : "bg-[var(--gradient-neon)]"
        }`}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {label}
          </div>
          <div
            className={`mt-1 text-xl font-bold ${tone === "emerald" ? "text-emerald-glow" : "text-neon"}`}
          >
            {value}
          </div>
        </div>
        <div
          className={`grid h-9 w-9 place-items-center rounded-md ${
            tone === "emerald"
              ? "bg-[oklch(0.92_0.2_105/0.12)] text-emerald-glow"
              : "bg-[oklch(0.7_0.22_245/0.12)] text-neon"
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function UserCard({
  u,
  isMe,
  isSupport,
  busy,
  onGrant,
  onRevoke,
  onDelete,
}: {
  u: AdminUser;
  isMe: boolean;
  isSupport: boolean;
  busy: string | null;
  onGrant: (id: string, role: "admin" | "super_admin") => void;
  onRevoke: (id: string, role: "admin" | "super_admin") => void;
  onDelete: (u: AdminUser) => void;
}) {
  const isSuper = u.roles.includes("super_admin");
  const isAdmin = u.roles.includes("admin");
  const initials = (u.profile?.display_name ?? u.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div
      className={`glass relative overflow-hidden p-4 transition ${
        isSuper ? "ring-1 ring-[oklch(0.92_0.2_105/0.4)]" : ""
      }`}
    >
      {isSuper && (
        <div
          className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-30 blur-2xl"
          style={{ background: "var(--gradient-emerald)" }}
        />
      )}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg font-mono text-sm font-bold ${
              isSuper
                ? "bg-[var(--gradient-emerald)] text-[oklch(0.12_0.02_260)]"
                : isAdmin
                  ? "bg-[var(--gradient-neon)] text-[oklch(0.12_0.02_260)]"
                  : "bg-white/5 text-foreground"
            }`}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold">
                {u.profile?.display_name || u.email}
              </div>
              {isMe && <span className="chip chip-neon !py-0.5 !text-[9px]">YO</span>}
              {isSupport && (
                <span className="chip !border-emerald-glow/50 !text-emerald-glow !py-0.5 !text-[9px]">
                  SOPORTE PROTEGIDO
                </span>
              )}
            </div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">{u.email}</div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {isSuper && (
                <span className="chip !border-emerald-glow/50 !bg-[oklch(0.92_0.2_105/0.12)] !text-emerald-glow !py-0.5 !text-[9px]">
                  <Crown className="h-2.5 w-2.5" />
                  SUPER
                </span>
              )}
              {!isSupport && isAdmin && !isSuper && (
                <span className="chip !border-neon/50 !text-neon !py-0.5 !text-[9px]">
                  <Shield className="h-2.5 w-2.5" />
                  ADMIN
                </span>
              )}
              {!isAdmin && !isSuper && <span className="chip !py-0.5 !text-[9px]">USER</span>}
              {u.profile?.entity_type && (
                <span className="chip !py-0.5 !text-[9px]">
                  {ENTITY_LABEL[u.profile.entity_type as "natural" | "juridica"]}
                </span>
              )}
              {u.profile?.sector && (
                <span className="chip !py-0.5 !text-[9px]">
                  {
                    SECTOR_LABEL[
                      u.profile.sector as "transporte" | "comercio" | "servicios" | "manufactura"
                    ]
                  }
                </span>
              )}
              {!u.profile?.onboarded && (
                <span className="chip !border-yellow-500/50 !text-yellow-400 !py-0.5 !text-[9px]">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  PENDIENTE
                </span>
              )}
              {!u.confirmed && (
                <span className="chip !border-red-500/50 !text-red-400 !py-0.5 !text-[9px]">
                  <XCircle className="h-2.5 w-2.5" />
                  NO VERIFICADO
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* mini-stats */}
      <div className="mt-3 grid grid-cols-4 gap-2 border-t border-white/5 pt-3">
        <MiniStat label="Ingresos" value={fmt(u.stats.income)} tone="emerald" />
        <MiniStat label="Gastos" value={fmt(u.stats.expense)} tone="neon" />
        <MiniStat label="Movs" value={u.stats.records.toString()} />
        <MiniStat label="OCR" value={u.stats.docs.toString()} />
      </div>

      {/* actions */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {!isAdmin && (
          <button
            disabled={busy === u.id + "admin"}
            onClick={() => onGrant(u.id, "admin")}
            className="btn-neon !py-1.5 !text-xs inline-flex items-center gap-1.5"
          >
            <Shield className="h-3 w-3" />
            Hacer admin
          </button>
        )}
        {isAdmin && !isSuper && (
          <button
            disabled={busy === u.id + "admin"}
            onClick={() => onRevoke(u.id, "admin")}
            className="btn-neon !py-1.5 !text-xs inline-flex items-center gap-1.5 !border-yellow-500/40 !text-yellow-400 hover:!bg-yellow-500/10"
          >
            <ShieldOff className="h-3 w-3" />
            Quitar admin
          </button>
        )}
        {!isSuper && (
          <button
            disabled={busy === u.id + "super_admin"}
            onClick={() => onGrant(u.id, "super_admin")}
            className="btn-emerald !py-1.5 !text-xs inline-flex items-center gap-1.5"
          >
            <Crown className="h-3 w-3" />
            Promover a SUPER
          </button>
        )}
        {!isSupport && isSuper && !isMe && (
          <button
            disabled={busy === u.id + "super_admin"}
            onClick={() => onRevoke(u.id, "super_admin")}
            className="btn-neon !py-1.5 !text-xs inline-flex items-center gap-1.5 !border-yellow-500/40 !text-yellow-400 hover:!bg-yellow-500/10"
          >
            <ShieldOff className="h-3 w-3" />
            Degradar SUPER
          </button>
        )}
        {!isMe && !isSupport && (
          <button
            disabled={busy === u.id + "del"}
            onClick={() => onDelete(u)}
            className="btn-neon !py-1.5 !text-xs inline-flex items-center gap-1.5 !border-red-500/40 !text-red-400 hover:!bg-red-500/10"
            title="Eliminar usuario"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "neon" | "emerald";
}) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={`truncate text-[11px] font-semibold ${
          tone === "emerald"
            ? "text-emerald-glow"
            : tone === "neon"
              ? "text-neon"
              : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
