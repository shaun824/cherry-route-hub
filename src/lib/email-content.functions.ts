// Admin view of what rider emails would actually print right now — built with the
// same helpers the mailer uses, so the page can never drift from the real email.
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

export const listEmailContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { riderScheduleForEmail, scheduleTrustedEventIds } = await import("./entry-welcome.server");

    // Only events that are open and selling entries matter here — past or
    // closed events no longer send schedule emails, so checking them is noise.
    const { data: events, error } = await supabaseAdmin
      .from("events")
      .select("id, name, event_date, days, schedule, website_url")
      .eq("lifecycle", "published")
      .gte("event_date", new Date().toISOString())
      .not("entry_ninja_url", "is", null)
      .order("event_date", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (events ?? []).map((e: any) => e.id as string);
    const trusted = await scheduleTrustedEventIds(supabaseAdmin, ids);

    const { data: syncs } = await supabaseAdmin
      .from("event_schedule_sync")
      .select("event_id, synced_at, verified, verified_at, needs_review, review_note, last_error")
      .in("event_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const byEvent = new Map((syncs ?? []).map((s: any) => [s.event_id, s]));

    // Trip-split events send a different schedule per trip — show each one.
    const { data: catRows } = await supabaseAdmin
      .from("event_entrants")
      .select("event_id, category")
      .in("event_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .limit(5000);
    const tripsByEvent = new Map<string, string[]>();
    for (const r of (catRows ?? []) as any[]) {
      const cat = String(r.category ?? "");
      if (!/trip\s*#?\s*\d+/i.test(cat)) continue;
      const list = tripsByEvent.get(r.event_id) ?? [];
      if (!list.includes(cat)) list.push(cat);
      tripsByEvent.set(r.event_id, list);
    }

    return {
      rows: (events ?? []).map((e: any) => {
        const isTrusted = trusted.has(e.id);
        const sync = byEvent.get(e.id) ?? null;
        const trips = (tripsByEvent.get(e.id) ?? []).sort();
        const variants = (trips.length ? trips : [null]).map((category) => ({
          category,
          days: riderScheduleForEmail(e, category, { trusted: isTrusted }),
        }));
        const anyTimes = variants.some((v) =>
          v.days.some((d) => d.items.some((i) => i.time && i.time !== "TBC")),
        );
        return {
          id: e.id as string,
          name: e.name as string,
          eventDate: (e.event_date as string | null) ?? null,
          websiteUrl: (e.website_url as string | null) ?? null,
          verified: Boolean(sync?.verified),
          needsReview: Boolean(sync?.needs_review),
          reviewNote: (sync?.review_note as string | null) ?? null,
          lastError: (sync?.last_error as string | null) ?? null,
          syncedAt: (sync?.synced_at as string | null) ?? null,
          verifiedAt: (sync?.verified_at as string | null) ?? null,
          hasSync: Boolean(sync),
          showsTbc: !anyTimes,
          variants,
        };
      }),
    };
  });

/** "Times are correct" — clears the review flag so mails print real times again. */
export const markScheduleVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("event_schedule_sync").upsert({
      event_id: data.eventId,
      verified: true,
      verified_at: now,
      needs_review: false,
      review_note: `Confirmed correct by an admin on ${now.slice(0, 10)}`,
      updated_at: now,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
