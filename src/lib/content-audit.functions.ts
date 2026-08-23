import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  approveFixSchema,
  assertAuditAdmin,
  dismissIssueSchema,
  issueKeySchema,
} from "@/lib/content-audit-schema";

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

    const { data: resolutions } = await context.supabase
      .from("content_audit_resolutions")
      .select("issue_key, status, note, resolved_at");
    return { runs: data ?? [], resolutions: resolutions ?? [] };
  });

/**
 * Warnings for the admin home-page card: the newest run's issues minus anything
 * already approved or dismissed. Also triggers a run when the last one is stale
 * (over 24h), so the daily check still lands even if the scheduler is quiet.
 */
export const getHomeAuditWarnings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAuditAdmin(context);

    let { data: latest } = await context.supabase
      .from("content_audit_runs")
      .select("id, run_at, issues, summary, issue_count")
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const stale =
      !latest || Date.now() - new Date(latest.run_at as string).getTime() > 24 * 3600 * 1000;
    if (stale) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { runAndStoreContentAudit } = await import("@/lib/content-audit.server");
      try {
        await runAndStoreContentAudit(supabaseAdmin);
        const { data } = await context.supabase
          .from("content_audit_runs")
          .select("id, run_at, issues, summary, issue_count")
          .order("run_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        latest = data ?? latest;
      } catch {
        /* keep the previous run on failure */
      }
    }

    const { data: resolutions } = await context.supabase
      .from("content_audit_resolutions")
      .select("issue_key");
    const done = new Set((resolutions ?? []).map((r: any) => r.issue_key));

    const issues = ((latest?.issues ?? []) as any[]).filter((i) => !done.has(i.key));
    return { runAt: latest?.run_at ?? null, summary: latest?.summary ?? null, issues };
  });

/** Approve an audit fix: apply the change, then mark the warning resolved. */
export const approveAuditFix = createServerFn({ method: "POST" })
  .inputValidator((d) => approveFixSchema.parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAuditAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applyAuditAction } = await import("@/lib/content-audit.server");
    const result = await applyAuditAction(supabaseAdmin, data.action as never);

    await supabaseAdmin.from("content_audit_resolutions").upsert(
      {
        issue_key: data.issueKey,
        status: "approved",
        area: data.area ?? null,
        event_id: data.action.eventId,
        message: data.message ?? null,
        note: result,
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
      },
      { onConflict: "issue_key" },
    );
    return { message: result };
  });

/** Dismiss a warning without changing anything (it stays hidden on later runs). */
export const dismissAuditIssue = createServerFn({ method: "POST" })
  .inputValidator((d) => dismissIssueSchema.parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAuditAdmin(context);
    const { error } = await context.supabase.from("content_audit_resolutions").upsert(
      {
        issue_key: data.issueKey,
        status: "dismissed",
        area: data.area ?? null,
        event_id: data.eventId ?? null,
        message: data.message ?? null,
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
      },
      { onConflict: "issue_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Bring a dismissed warning back. */
export const restoreAuditIssue = createServerFn({ method: "POST" })
  .inputValidator((d) => issueKeySchema.parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAuditAdmin(context);
    const { error } = await context.supabase
      .from("content_audit_resolutions")
      .delete()
      .eq("issue_key", data.issueKey);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Run the audit immediately (admin only). */
export const runContentAuditNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAuditAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runAndStoreContentAudit } = await import("@/lib/content-audit.server");
    const result = await runAndStoreContentAudit(supabaseAdmin);
    return { summary: result.summary, issues: result.issues, eventsChecked: result.eventsChecked };
  });
