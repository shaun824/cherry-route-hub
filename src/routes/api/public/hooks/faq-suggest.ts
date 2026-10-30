// Nightly job: drafts FAQ entries from recent rider/admin conversations.
// Called by pg_cron; drafts land as "suggested" and need admin approval.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/faq-suggest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = await verifyCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { suggestLearnedFaqs } = await import("@/lib/faq-suggest.server");

        try {
          const summary = await suggestLearnedFaqs(supabaseAdmin);
          console.log("[faq-suggest]", JSON.stringify(summary));
          return new Response(JSON.stringify({ success: true, ...summary }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("[faq-suggest] failed", err);
          return new Response(
            JSON.stringify({ success: false, error: (err as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
