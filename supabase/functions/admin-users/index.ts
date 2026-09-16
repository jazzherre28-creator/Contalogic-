// Admin-only edge function: list all users with emails + roles, manage roles.
// Verifies caller is super_admin via JWT before any admin op.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller client (with their JWT) — used to verify identity & role
    const caller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await caller.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client — bypasses RLS
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify caller is super_admin
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isSuperAdmin =
      callerRoles?.some((r: { role: string }) => r.role === "super_admin") ??
      false;
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "list";

    if (action === "list") {
      // List all auth users (admin API)
      const { data: usersList, error: usersErr } =
        await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (usersErr) throw usersErr;

      const userIds = usersList.users.map((u) => u.id);

      const [profilesRes, rolesRes, recordsRes, ocrRes] = await Promise.all([
        admin.from("profiles").select("*").in("id", userIds),
        admin.from("user_roles").select("user_id, role, assigned_at"),
        admin
          .from("financial_records")
          .select("user_id, amount, kind")
          .in("user_id", userIds),
        admin
          .from("ocr_documents")
          .select("user_id, doc_type")
          .in("user_id", userIds),
      ]);

      const profilesMap = new Map(
        (profilesRes.data ?? []).map((p: { id: string }) => [p.id, p]),
      );
      const rolesMap = new Map<string, string[]>();
      for (const r of rolesRes.data ?? []) {
        const arr = rolesMap.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesMap.set(r.user_id, arr);
      }
      const statsMap = new Map<
        string,
        { income: number; expense: number; records: number; docs: number }
      >();
      for (const id of userIds) {
        statsMap.set(id, { income: 0, expense: 0, records: 0, docs: 0 });
      }
      for (const r of recordsRes.data ?? []) {
        const s = statsMap.get(r.user_id)!;
        s.records += 1;
        if (r.kind === "income") s.income += Number(r.amount);
        else s.expense += Number(r.amount);
      }
      for (const d of ocrRes.data ?? []) {
        const s = statsMap.get(d.user_id)!;
        s.docs += 1;
      }

      const users = usersList.users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        confirmed: !!u.email_confirmed_at,
        profile: profilesMap.get(u.id) ?? null,
        roles: rolesMap.get(u.id) ?? [],
        stats: statsMap.get(u.id) ?? {
          income: 0,
          expense: 0,
          records: 0,
          docs: 0,
        },
      }));

      return new Response(JSON.stringify({ users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "grant_role" || action === "revoke_role") {
      const targetUserId: string = body.user_id;
      const role: string = body.role;
      if (!targetUserId || !["admin", "super_admin"].includes(role)) {
        return new Response(JSON.stringify({ error: "Bad params" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (action === "grant_role") {
        const { error } = await admin
          .from("user_roles")
          .insert({
            user_id: targetUserId,
            role,
            assigned_by: user.id,
          });
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        // Prevent removing the last super_admin
        if (role === "super_admin") {
          const { count } = await admin
            .from("user_roles")
            .select("*", { count: "exact", head: true })
            .eq("role", "super_admin");
          if ((count ?? 0) <= 1) {
            return new Response(
              JSON.stringify({
                error: "No puedes quitar el último super administrador",
              }),
              {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
        }
        const { error } = await admin
          .from("user_roles")
          .delete()
          .eq("user_id", targetUserId)
          .eq("role", role);
        if (error) throw error;
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_user") {
      const targetUserId: string = body.user_id;
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: "Bad params" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (targetUserId === user.id) {
        return new Response(
          JSON.stringify({ error: "No puedes eliminarte a ti mismo" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const { error } = await admin.auth.admin.deleteUser(targetUserId);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-users error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "Server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
