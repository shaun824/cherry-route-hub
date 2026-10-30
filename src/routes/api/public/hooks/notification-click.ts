// Records that a rider tapped a push notification (open-rate stats only).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/notification-click")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let deliveryId = "";
        try {
          const body = (await request.json()) as { deliveryId?: string };
          deliveryId = String(body.deliveryId ?? "");
        } catch {
          return new Response(JSON.stringify({ ok: false }), { status: 400 });
        }

        const [notificationId, subscriptionId] = deliveryId.split(":");
        if (!notificationId || !/^[0-9a-f-]{36}$/i.test(notificationId)) {
          return new Response(JSON.stringify({ ok: false }), { status: 400 });
        }

        const { resolveOptionalUserId } = await import("@/lib/app-bot.server");
        const userId = await resolveOptionalUserId(request.headers.get("authorization"));
        if (!userId) return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: existing } = await supabaseAdmin.from("notification_deliveries").select("id, clicked_at").eq("notification_id", notificationId).eq("subscription_id", subscriptionId ?? "").eq("user_id", userId).maybeSingle();
        if (existing && !existing.clicked_at) await supabaseAdmin.from("notification_deliveries").update({ clicked_at: new Date().toISOString() }).eq("id", existing.id).eq("user_id", userId);

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
