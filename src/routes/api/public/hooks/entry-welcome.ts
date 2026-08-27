// Sends any outstanding "you're in" entry welcome emails. Runs on its own
// schedule so a slow Entry Ninja sync can never swallow the mail run.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/entry-welcome")({
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
