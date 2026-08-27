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

/** Per-event schedule scrape status for the admin screen. */
export const listScheduleSyncs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { data: events, error } = await context.supabase
      .from("events")
      .select("id, name, event_date, website_url, schedule")
      .neq("lifecycle", "archived")
      .order("event_date", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: syncs } = await context.supabase
      .from("event_schedule_sync")
      .select("event_id, items, sources, auto_apply, synced_at, applied_at, last_error, verified, verified_at, needs_review, review_note");

    const byEvent = new Map((syncs ?? []).map((s: any) => [s.event_id, s]));
    return {
      rows: (events ?? []).map((e: any) => ({
        id: e.id as string,
        name: e.name as string,
        eventDate: e.event_date as string | null,
        websiteUrl: (e.website_url as string | null) ?? null,
        scheduleCount: Array.isArray(e.schedule) ? e.schedule.length : 0,
        sync: (byEvent.get(e.id) as any) ?? null,
      })),
    };
  });

/** Scrape one event (or all of them) now. */
export const runScheduleSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId?: string; forceApply?: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncEventSchedule, syncAllEventSchedules } = await import("@/lib/schedule-scrape.server");

    if (data.eventId) {
      const { data: event, error } = await supabaseAdmin
        .from("events")
        .select("id, name, event_date, location, website_url, faq_url, days, schedule")
        .eq("id", data.eventId)
        .maybeSingle();
      if (error || !event) throw new Error(error?.message ?? "Event not found");
      const result = await syncEventSchedule(supabaseAdmin, event as any, { forceApply: data.forceApply });
      return { results: [result] };
    }

    const summary = await syncAllEventSchedules(supabaseAdmin, { forceApply: data.forceApply });
    return { results: summary.results };
  });

/** Apply the last scraped schedule to the live event. */
export const applyScrapedSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { toScheduleItems } = await import("@/lib/schedule-scrape.server");

    const { data: sync } = await supabaseAdmin
      .from("event_schedule_sync")
      .select("items")
      .eq("event_id", data.eventId)
      .maybeSingle();
    const items = (sync?.items as any[]) ?? [];
    if (!items.length) throw new Error("Nothing scraped for this event yet");

    const { data: event } = await supabaseAdmin
      .from("events")
      .select("days")
      .eq("id", data.eventId)
      .maybeSingle();

    const schedule = toScheduleItems(items as any, ((event?.days as any[]) ?? []) as any);
    const { error } = await supabaseAdmin.from("events").update({ schedule }).eq("id", data.eventId);
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("event_schedule_sync")
      .update({
        applied_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        verified: true,
        verified_at: new Date().toISOString(),
        needs_review: false,
      })
      .eq("event_id", data.eventId);
    return { applied: schedule.length };
  });

/** Turn automatic updates on/off for one event. */
export const setScheduleAutoApply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; autoApply: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("event_schedule_sync").upsert({
      event_id: data.eventId,
      auto_apply: data.autoApply,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
