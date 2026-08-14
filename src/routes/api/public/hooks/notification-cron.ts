// Hourly job: sends the 7-day and 1-day "your event is coming up" reminders.
// Idempotent — each event/milestone has a unique dedupe key.
import { createFileRoute } from "@tanstack/react-router";

const MILESTONES: { days: number; key: string; label: string }[] = [
  { days: 7, key: "7d", label: "one week" },
  { days: 1, key: "1d", label: "tomorrow" },
];

export const Route = createFileRoute("/api/public/hooks/notification-cron")({
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
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { dispatchNotification } = await import("@/lib/notifications.server");
        const admin: any = supabaseAdmin;

        const now = Date.now();
        const horizon = new Date(now + 8 * 24 * 60 * 60 * 1000).toISOString();
        const { data: events } = await admin
          .from("events")
          .select("id, name, slug, event_date, location")
          .not("event_date", "is", null)
          .gte("event_date", new Date(now).toISOString())
          .lte("event_date", horizon)
          .neq("status", "archived");

        const sent: string[] = [];

        for (const ev of events ?? []) {
          const daysAway = (new Date(ev.event_date).getTime() - now) / 86400000;
          for (const m of MILESTONES) {
            // fire when we are inside the milestone window (within the hour)
            if (daysAway > m.days || daysAway <= m.days - 1 / 24) continue;
            const result = await dispatchNotification({
              title:
                m.days === 1 ? `${ev.name} is tomorrow` : `${ev.name} is ${m.label} away`,
              body:
                m.days === 1
                  ? `Check your start batch, kit list and rooming details before you head out${ev.location ? ` to ${ev.location}` : ""}.`
                  : `Your entry details, routes and packing list are ready in the Rider Hub.`,
              url: `/my-events/${ev.id}`,
              audience: "event",
              eventId: ev.id,
              kind: "event_reminder",
              source: "reminder",
              dedupeKey: `reminder:${ev.id}:${m.key}`,
            });
            if (!result.skipped) sent.push(`${ev.name} ${m.key} → ${result.delivered}`);
          }
        }

        return new Response(JSON.stringify({ success: true, sent }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
