// Daily re-check of every event website for where the event moves to each night.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/venue-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = await verifyCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncAllEventVenues } = await import("@/lib/venue-scrape.server");

        try {
          const summary = await syncAllEventVenues(supabaseAdmin);
          console.log("[venue-sync]", JSON.stringify(summary));
          return new Response(JSON.stringify({ success: true, ...summary }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("[venue-sync] failed", err);
          return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
