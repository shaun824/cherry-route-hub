// Pulls every event's linked run sheet from Google Sheets. Called by pg_cron.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/run-sheet-sync")({
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
