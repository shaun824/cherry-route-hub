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

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin: any = supabaseAdmin;

        const { data: existing } = await admin
          .from("notification_deliveries")
          .select("id, clicked_at")
          .eq("notification_id", notificationId)
          .eq("subscription_id", subscriptionId ?? "")
          .maybeSingle();

        if (existing && !existing.clicked_at) {
          await admin
            .from("notification_deliveries")
            .update({ clicked_at: new Date().toISOString() })
            .eq("id", existing.id);
          const { data: n } = await admin
            .from("notifications")
            .select("clicked_count")
            .eq("id", notificationId)
            .maybeSingle();
          await admin
            .from("notifications")
            .update({ clicked_count: (n?.clicked_count ?? 0) + 1 })
            .eq("id", notificationId);
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
