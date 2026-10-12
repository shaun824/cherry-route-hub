// Expires idle Cherry Miles balances. Called on a schedule (monthly is plenty).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/loyalty-expiry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = await verifyCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { expireIdlePoints } = await import("@/lib/loyalty.server");

        try {
          const result = await expireIdlePoints(supabaseAdmin as never);
          console.log("[loyalty-expiry]", result);
          return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("[loyalty-expiry] failed", err);
          return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
