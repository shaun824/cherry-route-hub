// Every 5 minutes: 15 minutes before each start batch goes, push entered riders in
// that batch a one-tap "start live tracking" reminder. Opens ?track=1 on the event,
// which starts tracking straight away. Idempotent per event/batch/day.
import { createFileRoute } from "@tanstack/react-router";
import { BATCH_REMINDER_LEAD_MS, sastTimeMs, sastToday } from "@/lib/tracking-auto";

const DAY_MS = 86_400_000;

export const Route = createFileRoute("/api/public/hooks/batch-start-reminder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyCronRequest } = await import("@/lib/cron-auth.server");
        const denied = await verifyCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { dispatchNotification } = await import("@/lib/notifications.server");
        const admin: any = supabaseAdmin;
        const now = Date.now();
        const today = sastToday(now);

        const { data: events } = await admin
          .from("events")
          .select("id, name, event_date, days, batches, status, is_review_event")
          .not("event_date", "is", null)
          .gte("event_date", new Date(now - 14 * DAY_MS).toISOString())
          .lte("event_date", new Date(now + DAY_MS).toISOString())
          .neq("status", "archived");

        const sent: string[] = [];
        for (const ev of events ?? []) {
          if (ev.is_review_event) continue;
          const startDay = sastToday(new Date(ev.event_date).getTime());
          const extra = Array.isArray(ev.days) && ev.days.length > 0 ? ev.days.length - 1 : 0;
          const endDay = sastToday(new Date(ev.event_date).getTime() + extra * DAY_MS);
          if (today < startDay || today > endDay) continue;
          for (const b of (ev.batches ?? []) as { id?: string; name?: string; startTime?: string }[]) {
            if (!b?.name || !b.startTime) continue;
            const start = sastTimeMs(today, b.startTime);
            if (start === null) continue;
            const lead = start - now;
            // Fire once in the 5-minute slot that lands ~15 minutes before the start.
            if (lead > BATCH_REMINDER_LEAD_MS || lead <= BATCH_REMINDER_LEAD_MS - 5 * 60_000) continue;
            const result = await dispatchNotification({
              title: "Your batch starts soon",
              body: "Tap here to start live tracking.",
              url: `/my-events/${ev.id}?track=1`,
              audience: "batch",
              batch: b.name,
              eventId: ev.id,
              kind: "event_reminder",
              source: "batch-start",
              dedupeKey: `batch-start:${ev.id}:${b.id ?? b.name}:${today}`,
            });
            if (!result.skipped) sent.push(`${ev.name} ${b.name} → ${result.delivered}`);
          }
        }
        return new Response(JSON.stringify({ success: true, sent }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
