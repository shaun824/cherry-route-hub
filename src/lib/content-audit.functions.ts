import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Latest stored audit runs (admin only via RLS). */
export const listContentAudits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("content_audit_runs")
      .select("id, run_at, status, events_checked, issue_count, issues, summary, error")
      .order("run_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { runs: data ?? [] };
  });

/** Run the audit immediately (admin only). */
export const runContentAuditNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roles) throw new Error("Admins only");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runAndStoreContentAudit } = await import("@/lib/content-audit.server");
    const result = await runAndStoreContentAudit(supabaseAdmin);
    return { summary: result.summary, issues: result.issues, eventsChecked: result.eventsChecked };
  });
