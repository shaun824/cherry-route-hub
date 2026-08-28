// Sends the one-off "sorry about the TBC times" mail with the rider's real,
// verified schedule for the exact trip they entered.
import {
  absoluteLogo,
  riderScheduleForEmail,
  scheduleTrustedEventIds,
  tripNumberOf,
  venueMapUrl,
} from "./entry-welcome.server";

type AnyClient = any;

export type ApologyBatchResult = {
  candidates: number;
  sent: number;
  skipped: number;
  suppressed: number;
  errors: string[];
};

const EVENT_SELECT =
  "id, name, event_date, location, map_query, days, schedule, logo_url, cover_url";

function firstName(fullName?: string | null) {
  const n = (fullName ?? "").trim().split(/\s+/)[0];
  return n || undefined;
}

/** "Darlington Trip 1 | 22 - 25 April 2027" -> { name: "Trip 1", dates: "22 – 25 April 2027" } */
export function tripFromCategory(category: string | null | undefined) {
  const c = (category ?? "").trim();
  const num = tripNumberOf(c);
  const afterPipe = c.includes("|") ? c.split("|").slice(1).join("|").trim() : "";
  const dates = /\d/.test(afterPipe) ? afterPipe.replace(/\s-\s/g, " – ") : null;
  return { name: num ? `Trip ${num}` : null, dates };
}

export async function buildApologyData(
  admin: AnyClient,
  event: any,
  opts: { firstName?: string; category?: string | null },
) {
  const trusted = (await scheduleTrustedEventIds(admin, [event.id])).has(event.id);
  const trip = tripFromCategory(opts.category);
  return {
    firstName: opts.firstName ?? undefined,
    eventName: event.name,
    tripName: trip.name,
    tripDates: trip.dates,
    venue: event.location ?? null,
    venueUrl: venueMapUrl(event.location, event.map_query),
    eventUrl: `https://riderapp.redcherryevents.co.za/my-events/${event.id}`,
    eventCoverUrl: absoluteLogo(event.cover_url),
    eventLogoUrl: absoluteLogo(event.logo_url),
    schedule: riderScheduleForEmail(event, opts.category ?? null, { trusted }),
  };
}

/** One preview copy to an admin — never touches entry records. */
export async function sendApologyTest(
  admin: AnyClient,
  opts: { eventId: string; to: string; category?: string | null; firstName?: string },
) {
  const { data: event } = await admin
    .from("events")
    .select(EVENT_SELECT)
    .eq("id", opts.eventId)
    .maybeSingle();
  if (!event) throw new Error("Event not found");

  const { sendTemplateEmail } = await import("./email-templates/send-email");
  const templateData = await buildApologyData(admin, event, {
    firstName: opts.firstName ?? "Shaun",
    category: opts.category ?? null,
  });
  const send = await sendTemplateEmail("schedule-apology", opts.to, {
    idempotencyKey: `schedule-apology-test-${event.id}-${Date.now()}`,
    templateData,
  });
  return { to: opts.to, eventName: event.name, days: templateData.schedule.length, ...send };
}

/**
 * Sends the apology to everyone entered for the event who has not had it yet,
 * one mail per email address per trip, using that rider's own trip schedule.
 */
export async function sendScheduleApologies(
  admin: AnyClient,
  opts: { eventId: string; limit?: number; emails?: string[] },
): Promise<ApologyBatchResult> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200);
  const result: ApologyBatchResult = { candidates: 0, sent: 0, skipped: 0, suppressed: 0, errors: [] };

  const only = new Set(
    (opts.emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean),
  );

  const { data: event } = await admin
    .from("events")
    .select(EVENT_SELECT)
    .eq("id", opts.eventId)
    .maybeSingle();
  if (!event) throw new Error("Event not found");

  const query = admin
    .from("event_entrants")
    .select("id, category, entrants(full_name, email)")
    .eq("event_id", opts.eventId)
    .eq("welcome_email_skipped", false)
    .limit(500);
  // When specific addresses are given we re-send to exactly those, even if they
  // already had an apology; otherwise only riders who never got one.
  if (only.size === 0) query.is("schedule_apology_sent_at", null);
  const { data, error } = await query;
  if (error) throw error;

  // One mail per address per trip; everyone else on the entry is stamped too.
  const groups = new Map<string, { email: string; name: string | null; category: string | null; ids: string[] }>();
  for (const row of (data ?? []) as any[]) {
    const email = (row.entrants?.email ?? "").trim().toLowerCase();
    if (!email) {
      result.skipped++;
      continue;
    }
    if (only.size > 0 && !only.has(email)) {
      result.skipped++;
      continue;
    }
    const key = `${email}|${tripNumberOf(row.category) ?? "-"}`;
    const g = groups.get(key);
    if (g) g.ids.push(row.id);
    else
      groups.set(key, {
        email,
        name: row.entrants?.full_name ?? null,
        category: row.category ?? null,
        ids: [row.id],
      });
  }

  const { sendTemplateEmail } = await import("./email-templates/send-email");

  for (const g of groups.values()) {
    if (result.sent + result.suppressed >= limit) break;
    result.candidates++;
    try {
      const templateData = await buildApologyData(admin, event, {
        ...(firstName(g.name) ? { firstName: firstName(g.name) as string } : {}),
        category: g.category,
      });
      const send = await sendTemplateEmail("schedule-apology", g.email, {
        idempotencyKey: `schedule-apology-${event.id}-${g.email}-${tripNumberOf(g.category) ?? "x"}${only.size > 0 ? `-${Date.now()}` : ""}`,
        templateData,
      });
      await admin
        .from("event_entrants")
        .update({ schedule_apology_sent_at: new Date().toISOString() })
        .in("id", g.ids);
      if (send.sent) result.sent++;
      else result.suppressed++;
    } catch (err) {
      if (result.errors.length < 10) result.errors.push(`${g.email}: ${(err as Error).message}`);
    }
  }

  return result;
}
