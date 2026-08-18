// Scheduled Entry Ninja refresh. Called by pg_cron 4x daily (08:00/12:00/16:00/20:00 SAST).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/entry-ninja-sync")({
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
        const { syncAllLinkedEvents } = await import("@/lib/entryninja-sync.server");
        const { sendPendingEntryWelcomes } = await import("@/lib/entry-welcome.server");

        try {
          const summary = await syncAllLinkedEvents(supabaseAdmin);
          // Keep roster records attached to app accounts as riders sign up.
          let linkedAccounts: unknown = null;
          try {
            const { linkEntrantsToAccounts } = await import("@/lib/entryninja-archive.server");
            linkedAccounts = await linkEntrantsToAccounts(supabaseAdmin);
          } catch (linkErr) {
            console.error("[entry-ninja-sync] account linking failed", linkErr);
          }
          // Every brand-new entry gets a "you're in" email pointing at its event page.
          let welcome: unknown = null;
          try {
            welcome = await sendPendingEntryWelcomes(supabaseAdmin, { limit: 100 });
          } catch (mailErr) {
            console.error("[entry-ninja-sync] welcome emails failed", mailErr);
          }
          console.log("[entry-ninja-sync]", JSON.stringify({ ...summary, welcome, linkedAccounts }));
          return new Response(JSON.stringify({ success: true, ...summary, welcome, linkedAccounts }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("[entry-ninja-sync] failed", err);
          return new Response(
            JSON.stringify({ success: false, error: (err as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
