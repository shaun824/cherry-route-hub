// Pulls every event's linked run sheet from Google Sheets. Called by pg_cron.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/run-sheet-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = await verifyCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncEventRunSheet } = await import("@/lib/run-sheet.server");

        const { data: events, error } = await supabaseAdmin
          .from("events")
          .select("id")
          .not("run_sheet_url", "is", null);
        if (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const results = [];
        for (const e of events ?? []) {
          try {
            results.push(await syncEventRunSheet(supabaseAdmin as never, e.id));
          } catch (err) {
            results.push({ ok: false, event: e.id, error: (err as Error).message });
          }
        }
        console.log("[run-sheet-sync]", JSON.stringify(results));
        return new Response(JSON.stringify({ success: true, results }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
