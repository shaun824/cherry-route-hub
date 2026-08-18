// Server-only: full-archive backfill. Walks EVERY event on the Entry Ninja
// account (not just the ones already linked in the app) so that every person
// who has ever entered with us exists in our roster, with their ID hash stored
// and their entrant record linked to their app profile where we can match it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchEnEvents, type EnEvent } from "./entryninja.server";
import { resolveOrCreateEvent, syncEnEvent } from "./entryninja-sync.server";

type AnyClient = SupabaseClient<any, any, any>;

export type ArchiveEventResult = {
  enEventId: number;
  eventName: string;
  date: string | null;
  ok: boolean;
  createdEvent: boolean;
  totalEntries: number;
  created: number;
  updated: number;
  linked: number;
  skipped: number;
  error?: string;
};

/** Newest first so the most relevant history lands earliest in a long backfill. */
export async function listArchiveEvents(): Promise<EnEvent[]> {
  const events = await fetchEnEvents();
  return [...events].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

function isPast(date: string | null | undefined): boolean {
  if (!date) return false;
  const t = new Date(date).getTime();
  return Number.isFinite(t) && t < Date.now();
}

/**
 * Processes a slice of the Entry Ninja archive. The admin screen calls this in
 * chunks so a long history never trips a request timeout.
 */
export async function backfillArchiveChunk(
  supabase: AnyClient,
  opts: { start?: number; count?: number } = {},
): Promise<{ total: number; start: number; processed: number; nextStart: number | null; results: ArchiveEventResult[] }> {
  const all = await listArchiveEvents();
  const start = Math.max(0, opts.start ?? 0);
  const count = Math.min(Math.max(1, opts.count ?? 3), 10);
  const slice = all.slice(start, start + count);

  const results: ArchiveEventResult[] = [];
  for (const en of slice) {
    try {
      const { eventId, createdEvent } = await resolveOrCreateEvent(supabase, en);
      // Past events we auto-create are archived so they never show up as live
      // events in the app — they exist purely to carry the entrant history.
      if (createdEvent && isPast(en.date)) {
        await supabase
          .from("events")
          .update({ lifecycle: "archived", status: "completed" })
          .eq("id", eventId);
      }
      const r = await syncEnEvent(supabase, { enEventId: en.id, eventId });
      results.push({
        enEventId: en.id,
        eventName: r.eventName,
        date: en.date ?? null,
        ok: true,
        createdEvent,
        totalEntries: r.totalEntries,
        created: r.created,
        updated: r.updated,
        linked: r.linked,
        skipped: r.skipped,
      });
    } catch (err) {
      results.push({
        enEventId: en.id,
        eventName: en.name,
        date: en.date ?? null,
        ok: false,
        createdEvent: false,
        totalEntries: 0,
        created: 0,
        updated: 0,
        linked: 0,
        skipped: 0,
        error: (err as Error).message,
      });
    }
  }

  const nextStart = start + slice.length < all.length ? start + slice.length : null;
  return { total: all.length, start, processed: slice.length, nextStart, results };
}

/**
 * Connects roster records to app accounts by email so a rider like Mark Tew —
 * who had a profile but no entrant row linked — sees their history straight
 * away instead of hitting "we couldn't confirm your identity".
 */
export async function linkEntrantsToAccounts(
  supabase: AnyClient,
): Promise<{ checked: number; linked: number; errors: string[] }> {
  const { data: profiles } = await supabase.from("profiles").select("id, email");
  const byEmail = new Map<string, string>();
  for (const p of (profiles ?? []) as { id: string; email: string | null }[]) {
    if (p.email) byEmail.set(p.email.trim().toLowerCase(), p.id);
  }

  const { data: entrants } = await supabase
    .from("entrants")
    .select("id, email, user_id")
    .is("user_id", null)
    .not("email", "is", null);

  const errors: string[] = [];
  let linked = 0;
  for (const e of (entrants ?? []) as { id: string; email: string | null }[]) {
    const uid = byEmail.get((e.email ?? "").trim().toLowerCase());
    if (!uid) continue;
    const { error } = await supabase.from("entrants").update({ user_id: uid }).eq("id", e.id);
    if (error) {
      if (errors.length < 10) errors.push(`${e.email}: ${error.message}`);
      continue;
    }
    linked++;
  }

  return { checked: (entrants ?? []).length, linked, errors };
}
