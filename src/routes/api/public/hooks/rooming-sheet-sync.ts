// Pulls every venue's linked Google Sheet rooming list. Called by pg_cron.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/rooming-sheet-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace("Bearer ", "") ??
          "";
        const expected =
          import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
          process.env["SUPABASE_PUBLISHABLE_KEY"] ??
          "";

        if (!apikey || (expected && apikey !== expected)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncVenueSheet } = await import("@/lib/rooming-sync.server");

        const { data: venues, error } = await supabaseAdmin
          .from("event_venues")
          .select("id")
          .not("rooming_sheet_url", "is", null);
        if (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const results = [];
        for (const v of venues ?? []) {
          try {
            results.push(await syncVenueSheet(supabaseAdmin as never, v.id));
          } catch (err) {
            results.push({ ok: false, venue: v.id, error: (err as Error).message });
          }
        }
        console.log("[rooming-sheet-sync]", JSON.stringify(results));
        return new Response(JSON.stringify({ success: true, results }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
