// Routine content consistency check. Called by pg_cron every 2 days.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/content-audit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = await verifyCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runAndStoreContentAudit } = await import("@/lib/content-audit.server");

        try {
          const result = await runAndStoreContentAudit(supabaseAdmin);
          console.log("[content-audit]", result.summary);
          return new Response(
            JSON.stringify({ success: true, summary: result.summary, issues: result.issues.length }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          console.error("[content-audit] failed", err);
          return new Response(
            JSON.stringify({ success: false, error: (err as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
