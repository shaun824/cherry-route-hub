import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admins only");
}

/** What the website last told us about where an event moves to. */
export const getVenueSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { data: row } = await context.supabase
      .from("event_venue_sync")
      .select("stays, sources, synced_at, applied_at, last_error")
      .eq("event_id", data.eventId)
      .maybeSingle();
    return { sync: (row as any) ?? null };
  });

/** Scrape one event (or all of them) for its overnight venues. */
export const runVenueSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId?: string; apply?: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncEventVenues, syncAllEventVenues } = await import("@/lib/venue-scrape.server");

    if (data.eventId) {
      const { data: event, error } = await supabaseAdmin
        .from("events")
        .select("id, name, event_date, website_url, faq_url, days")
        .eq("id", data.eventId)
        .maybeSingle();
      if (error || !event) throw new Error(error?.message ?? "Event not found");
      const result = await syncEventVenues(supabaseAdmin, event as any, { apply: data.apply });
      return { results: [result] };
    }

    const summary = await syncAllEventVenues(supabaseAdmin, { apply: data.apply });
    return { results: summary.results };
  });

/** Apply the last scraped venue list to the event's venues. */
export const applyScrapedVenues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applyVenueRows } = await import("@/lib/venue-scrape.server");

    const { data: sync } = await supabaseAdmin
      .from("event_venue_sync")
      .select("stays")
      .eq("event_id", data.eventId)
      .maybeSingle();
    const stays = (sync?.stays as any[]) ?? [];
    if (!stays.length) throw new Error("Nothing scraped for this event yet");

    const res = await applyVenueRows(supabaseAdmin, data.eventId, stays as any);
    await supabaseAdmin
      .from("event_venue_sync")
      .update({ applied_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("event_id", data.eventId);
    return res;
  });
