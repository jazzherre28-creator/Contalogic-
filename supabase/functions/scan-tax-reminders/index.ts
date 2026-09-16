// Daily cron: scans tax_deadlines and creates in-app notifications
// for users with active reminders 3 days or 1 day before due date.
// Idempotent: skips if a notification already exists for that deadline+window.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targets = [1, 3]; // days before
  let created = 0;

  for (const days of targets) {
    const target = new Date(today);
    target.setDate(today.getDate() + days);
    const targetStr = target.toISOString().slice(0, 10);

    // Find all reminders whose deadline matches this date
    const { data: reminders } = await supabase
      .from("user_reminders")
      .select("id, user_id, deadline_id, status, tax_deadlines!inner(id, obligation, due_date, period, estatuto_article, sector, entity_type, nit_last_digit)")
      .eq("status", "pending")
      .eq("tax_deadlines.due_date", targetStr);

    if (!reminders) continue;

    for (const r of reminders as any[]) {
      const d = r.tax_deadlines;
      const tag = `deadline:${d.id}:d${days}`;
      // Idempotency: check if notification with this tag exists
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", r.user_id)
        .contains("data", { tag })
        .maybeSingle();
      if (existing) continue;

      const title = days === 1
        ? `⚠️ Vence MAÑANA: ${d.obligation}`
        : `🔔 Vence en 3 días: ${d.obligation}`;
      const body = `${d.obligation} (${d.period}) vence el ${d.due_date}.${d.estatuto_article ? ` Ref: ${d.estatuto_article}` : ""}`;

      const { error } = await supabase.from("notifications").insert({
        user_id: r.user_id,
        title,
        body,
        kind: days === 1 ? "danger" : "warning",
        link: "/calendar",
        data: { tag, deadline_id: d.id, days_left: days },
      });
      if (!error) created++;
    }
  }

  return new Response(JSON.stringify({ ok: true, created, ran_at: new Date().toISOString() }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
