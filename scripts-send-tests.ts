import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadPromoRows, offersForEvent, venueMapUrl, riderScheduleForEmail, absoluteLogo } from "@/lib/entry-welcome.server";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

const to = "shaun@redcherryevents.co.za";

const { data: events } = await supabaseAdmin
  .from("events")
  .select("id, name, event_date, location, map_query, days, schedule, logo_url, cover_url")
  .gte("event_date", new Date().toISOString())
  .order("event_date", { ascending: true });

const promos = await loadPromoRows(supabaseAdmin);

for (const event of (events ?? []) as any[]) {
  const eventUrl = `https://riderapp.redcherryevents.co.za/my-events/${event.id}`;
  const res = await sendTemplateEmail("entry-welcome", to, {
    idempotencyKey: `entry-welcome-test-${event.id}-${Date.now()}`,
    templateData: {
      firstName: "Shaun",
      eventName: event.name,
      eventDate: event.event_date
        ? new Date(event.event_date).toLocaleDateString("en-ZA", {
            weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg",
          })
        : null,
      venue: event.location ?? null,
      venueUrl: venueMapUrl(event.location, event.map_query),
      eventLogoUrl: absoluteLogo(event.logo_url),
      eventCoverUrl: absoluteLogo(event.cover_url),
      schedule: riderScheduleForEmail(event, null),
      category: "Test entry",
      bibNumber: null,
      eventUrl,
      actionUrl: eventUrl,
      needsPassword: false,
      offers: offersForEvent(promos, event.name),
      party: [],
    },
  });
  console.log(event.name, JSON.stringify(res));
}
