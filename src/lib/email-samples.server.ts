// Builds and sends one copy of every email the app can send, to an admin.
// Rider mails reuse the real builders so the samples can never drift from what
// riders actually receive.
const SITE_NAME = "Red Cherry Events Rider Hub";
const SITE_URL = "https://riderapp.redcherryevents.co.za";

export interface SampleResult {
  template: string;
  label: string;
  sent: boolean;
  error?: string;
}

export async function sendEmailSamples(opts: { to: string; eventId?: string | null }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendTemplateEmail } = await import("./email-templates/send-email");
  const {
    loadPromoRows,
    offersForEvent,
    venueMapUrl,
    riderScheduleForEmail,
    partySchedulesForEmail,
    absoluteLogo,
    scheduleTrustedEventIds,
  } = await import("./entry-welcome.server");

  // Next open, selling event — the same population the mailers work from.
  let q = supabaseAdmin
    .from("events")
    .select("id, name, event_date, location, map_query, days, schedule, logo_url, cover_url")
    .eq("lifecycle", "published")
    .gte("event_date", new Date().toISOString())
    .order("event_date", { ascending: true })
    .limit(1);
  if (opts.eventId) q = q.eq("id", opts.eventId);
  const { data: events } = await q;
  const event = events?.[0] as any;
  if (!event) throw new Error("No open event found to build the sample emails from");

  const trusted = (await scheduleTrustedEventIds(supabaseAdmin, [event.id])).has(event.id);
  const promos = await loadPromoRows(supabaseAdmin);
  const eventUrl = `${SITE_URL}/my-events/${event.id}`;
  const eventDate = event.event_date
    ? new Date(event.event_date).toLocaleDateString("en-ZA", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Africa/Johannesburg",
      })
    : null;
  const party = [
    { name: "Shaun Glover", category: "Sample class A", bibNumber: "101" },
    { name: "Sample Partner", category: "Sample class B", bibNumber: "102" },
  ];
  const stamp = Date.now();
  const url = `${SITE_URL}/auth?sample=1`;

  const jobs: { template: string; label: string; data: Record<string, any> }[] = [
    {
      template: "entry-welcome",
      label: "Entry welcome (sent when an Entry Ninja entry syncs)",
      data: {
        firstName: "Shaun",
        eventName: event.name,
        eventDate,
        venue: event.location ?? null,
        venueUrl: venueMapUrl(event.location, event.map_query),
        eventLogoUrl: absoluteLogo(event.logo_url),
        eventCoverUrl: absoluteLogo(event.cover_url),
        schedule: riderScheduleForEmail(event, null, { trusted }),
        category: "Sample class A",
        bibNumber: "101",
        eventUrl,
        actionUrl: eventUrl,
        needsPassword: false,
        offers: offersForEvent(promos, event.name),
        party,
        partySchedules: partySchedulesForEmail(event, party, { trusted }),
      },
    },
    {
      template: "schedule-apology",
      label: "Schedule correction / apology",
      data: {
        firstName: "Shaun",
        eventName: event.name,
        tripName: null,
        tripDates: null,
        venue: event.location ?? null,
        venueUrl: venueMapUrl(event.location, event.map_query),
        eventUrl,
        eventCoverUrl: absoluteLogo(event.cover_url),
        eventLogoUrl: absoluteLogo(event.logo_url),
        schedule: riderScheduleForEmail(event, null, { trusted }),
      },
    },
    {
      template: "crew-training-invite",
      label: "Crew portal invite + training",
      data: {
        firstName: "Shaun",
        email: opts.to,
        tempPassword: "Cherry-1234",
        loginUrl: `${SITE_URL}/auth`,
        learnUrl: `${SITE_URL}/crew/learn`,
      },
    },
    {
      template: "auth-signup",
      label: "Account: confirm your email",
      data: { siteName: SITE_NAME, siteUrl: SITE_URL, recipient: opts.to, confirmationUrl: url },
    },
    {
      template: "auth-invite",
      label: "Account: invite",
      data: {
        siteName: SITE_NAME,
        siteUrl: SITE_URL,
        confirmationUrl: url,
        firstName: "Shaun",
        events: [event.name],
      },
    },
    {
      template: "auth-magic-link",
      label: "Account: login link",
      data: { siteName: SITE_NAME, confirmationUrl: url },
    },
    {
      template: "auth-recovery",
      label: "Account: reset your password",
      data: { siteName: SITE_NAME, confirmationUrl: url },
    },
    {
      template: "auth-email-change",
      label: "Account: confirm new email",
      data: {
        siteName: SITE_NAME,
        oldEmail: opts.to,
        email: opts.to,
        newEmail: "new.address@example.com",
        confirmationUrl: url,
      },
    },
    {
      template: "auth-reauthentication",
      label: "Account: verification code",
      data: { token: "123456" },
    },
  ];

  const results: SampleResult[] = [];
  for (const job of jobs) {
    try {
      const res = await sendTemplateEmail(job.template, opts.to, {
        idempotencyKey: `sample-${job.template}-${stamp}`,
        templateData: job.data,
      });
      results.push({ template: job.template, label: job.label, sent: res.sent });
    } catch (err) {
      results.push({
        template: job.template,
        label: job.label,
        sent: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    to: opts.to,
    eventName: event.name as string,
    sent: results.filter((r) => r.sent).length,
    results,
  };
}
