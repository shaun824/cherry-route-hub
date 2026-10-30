// Weekly rebuild of the "This event" training courses, for the events we're
// currently open for. Courses for closed/archived events are hidden.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/learn-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = await verifyCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncOpenEventCourses } = await import("@/lib/learn.server");

        try {
          const body = (await request.json().catch(() => ({}))) as { force?: boolean };
          const summary = await syncOpenEventCourses(supabaseAdmin as never, { force: !!body.force });
          console.log("[learn-sync]", JSON.stringify(summary));
          return new Response(JSON.stringify({ success: true, ...summary }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("[learn-sync] failed", err);
          return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
