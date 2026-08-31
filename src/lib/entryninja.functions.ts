// Admin-only server functions that sync entries from Entry Ninja.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "./is-admin";

export const listEntryNinjaEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ includeClosed: z.boolean().optional() }).parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");

    const { fetchEnEvents, fetchOpenEnEvents } = await import("./entryninja.server");
    // Default view = events still open for entry. Closed events never change,
    // so we don't call Entry Ninja for them unless an admin asks.
    const [enEvents, local] = await Promise.all([
      data.includeClosed ? fetchEnEvents() : fetchOpenEnEvents(),
      context.supabase.from("events").select("id, name, entry_ninja_id, lifecycle"),
    ]);

    const byExternal = new Map<string, { id: string; name: string; lifecycle: string | null }>();
    const byName = new Map<string, { id: string; name: string; lifecycle: string | null }>();
    for (const e of local.data ?? []) {
      const rec = { id: e.id, name: e.name, lifecycle: (e as { lifecycle?: string | null }).lifecycle ?? null };
      if (e.entry_ninja_id) byExternal.set(String(e.entry_ninja_id), rec);
      if (e.name) byName.set(e.name.trim().toLowerCase(), rec);
    }

    return enEvents
      .map((e) => {
        const match = byExternal.get(String(e.id)) ?? byName.get(e.name.trim().toLowerCase()) ?? null;
        return {
          enId: e.id,
          name: e.name,
          date: e.date ?? null,
          venue: e.venue?.name ?? null,
          location: [e.venue?.city, e.venue?.province].filter(Boolean).join(", ") || null,
          matchedEventId: match?.id ?? null,
          matchedEventName: match?.name ?? null,
          archived: match?.lifecycle === "archived",
        };
      })
      .filter((e) => (data.includeClosed ? true : !e.archived))
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  });

const syncSchema = z.object({
  enEventId: z.number().int().positive(),
  eventId: z.string().uuid().optional(),
});

export const syncEntryNinjaEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => syncSchema.parse(data))
  .handler(async ({ data, context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");

    const { syncEnEvent } = await import("./entryninja-sync.server");
    return syncEnEvent(context.supabase, {
      enEventId: data.enEventId,
      ...(data.eventId ? { eventId: data.eventId } : {}),
    });
  });


const welcomeSchema = z.object({
  eventId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  mode: z.enum(["new", "backfill"]).optional(),
});

/** How many entries are still waiting on a welcome email. */
export const countEntryWelcomes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => welcomeSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { countPendingEntryWelcomes } = await import("./entry-welcome.server");
    return countPendingEntryWelcomes(supabaseAdmin, data.eventId ? { eventId: data.eventId } : {});
  });

/** Sends a controlled batch of "you're entered" welcome emails. */
export const sendEntryWelcomeBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => welcomeSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendPendingEntryWelcomes } = await import("./entry-welcome.server");
    return sendPendingEntryWelcomes(supabaseAdmin, {
      ...(data.eventId ? { eventId: data.eventId } : {}),
      limit: data.limit ?? 50,
      mode: data.mode ?? "new",
    });
  });

const testWelcomeSchema = z.object({
  eventId: z.string().uuid().optional(),
  email: z.string().trim().email().optional(),
  /** Preview the mail as a rider in this category (multi-trip events). */
  category: z.string().trim().optional(),
});

/**
 * Sends one preview copy of the welcome email to an admin, using a real event
 * and that event's live rider offers. Never touches entry records.
 */
export const sendTestEntryWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => testWelcomeSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");

    const to = (data.email || (context.claims as any)?.email || "").trim().toLowerCase();
    if (!to) throw new Error("No admin email address to send to");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadPromoRows, offersForEvent, venueMapUrl, riderScheduleForEmail, partySchedulesForEmail, absoluteLogo, scheduleTrustedEventIds } = await import("./entry-welcome.server");
    const { sendTemplateEmail } = await import("./email-templates/send-email");

    let eventQuery = supabaseAdmin
      .from("events")
      .select("id, name, event_date, location, map_query, days, schedule, logo_url, cover_url")
      .order("event_date", { ascending: true })
      .limit(1);
    if (data.eventId) eventQuery = eventQuery.eq("id", data.eventId);
    const { data: events } = await eventQuery;
    const event = events?.[0];
    if (!event) throw new Error("No event found to build the test email from");

    const promos = await loadPromoRows(supabaseAdmin);

    // Show a real multi-rider entry when the event has one, so the test mail
    // demonstrates the "everyone on this entry" list.
    const { data: partyRows } = await supabaseAdmin
      .from("event_entrants")
      .select("registration_ref, category, bib_number, entrants!inner(full_name, email)")
      .eq("event_id", event.id)
      .limit(500);
    const byEmail = new Map<string, { name: string; category: string | null; bibNumber: string | null }[]>();
    for (const r of (partyRows ?? []) as any[]) {
      const em = r.registration_ref || (r.entrants?.email ?? "").trim().toLowerCase();
      const name = (r.entrants?.full_name ?? "").trim();
      if (!em || !name) continue;
      const list = byEmail.get(em) ?? [];
      if (!list.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        list.push({ name, category: r.category ?? null, bibNumber: r.bib_number ?? null });
      }
      byEmail.set(em, list);
    }
    let party = [...byEmail.values()].sort((a, b) => b.length - a.length)[0] ?? [];
    if (party.length < 2) party = [];

    const eventUrl = `https://riderapp.redcherryevents.co.za/my-events/${event.id}`;

    const send = await sendTemplateEmail("entry-welcome", to, {
      idempotencyKey: `entry-welcome-test-${event.id}-${Date.now()}`,
      templateData: {
        firstName: "Shaun",
        eventName: event.name,
        eventDate: event.event_date
          ? new Date(event.event_date).toLocaleDateString("en-ZA", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "Africa/Johannesburg",
            })
          : null,
        venue: event.location ?? null,
        venueUrl: venueMapUrl(event.location, (event as { map_query?: string | null }).map_query),
        eventLogoUrl: absoluteLogo((event as any).logo_url),
        eventCoverUrl: absoluteLogo((event as any).cover_url),
        schedule: riderScheduleForEmail(event, data.category ?? party[0]?.category ?? null, {
          trusted: (await scheduleTrustedEventIds(supabaseAdmin, [event.id])).has(event.id),
        }),
        category: data.category ?? "Test entry",
        bibNumber: null,
        eventUrl,
        actionUrl: eventUrl,
        needsPassword: false,
        offers: offersForEvent(promos, event.name),
        party,
        partySchedules: partySchedulesForEmail(event, party, {
          trusted: (await scheduleTrustedEventIds(supabaseAdmin, [event.id])).has(event.id),
        }),
      },
    });

    return { to, eventName: event.name, offers: offersForEvent(promos, event.name).length, ...send };
  });
