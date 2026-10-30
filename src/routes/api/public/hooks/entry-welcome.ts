// Sends any outstanding "you're in" entry welcome emails. Runs on its own
// schedule so a slow Entry Ninja sync can never swallow the mail run.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/entry-welcome")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = await verifyCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendPendingEntryWelcomes } = await import("@/lib/entry-welcome.server");

        try {
          const result = await sendPendingEntryWelcomes(supabaseAdmin, { limit: 100 });
          console.log("[entry-welcome]", JSON.stringify(result));
          return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("[entry-welcome] failed", err);
          return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
