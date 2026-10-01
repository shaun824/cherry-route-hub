// Server-only: per-class "places left" straight from Entry Ninja (source of truth),
// cached in site_settings for 24 hours so website traffic never hits Entry Ninja directly.
import type { SupabaseClient } from "@supabase/supabase-js";

type AnyClient = SupabaseClient<any, any, any>;
const TTL_MS = 24 * 60 * 60 * 1000;

// Friendly keys for PE Plett classes; unknown classes fall back to "class-<id>".
const CLASS_KEYS: Record<number, string> = {
  297039: "ride-meals",
  297040: "day-ripper",
  297041: "double-tent",
  297042: "single-tent",
  297043: "chalet-1n",
  297044: "chalet-3n-double",
  297046: "chalet-3n-single",
};
// Classes left out of the headline total (day passes don't use the 250 places).
const EXCLUDED_FROM_TOTAL = new Set(["day-ripper"]);

export type ClassAvailability = {
  event: string;
  updated_at: string;
  classes: { key: string; class_id: number; name: string; taken: number; cap: number; left: number }[];
  totals: { taken: number; cap: number; left: number };
};

const left = (cap: number, taken: number) => Math.max(0, cap - taken);

async function buildFromEntryNinja(enEventId: number, eventName: string): Promise<ClassAvailability> {
  const { fetchEnEventDetail, fetchEnEntries } = await import("./entryninja.server");
  const [detail, entries] = await Promise.all([fetchEnEventDetail(enEventId), fetchEnEntries(enEventId)]);
  const counts = new Map<number, number>();
  for (const e of entries) {
    const id = e.class?.id;
    if (id != null) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const rawClasses = ((detail as any).classes ?? []) as { id: number; name: string; capacity?: number | null }[];
  const classes = rawClasses.map((c) => {
    const taken = counts.get(c.id) ?? 0;
    const cap = Number(c.capacity ?? 0) || 0;
    return { key: CLASS_KEYS[c.id] ?? `class-${c.id}`, class_id: c.id, name: c.name, taken, cap, left: left(cap, taken) };
  });
  const counted = classes.filter((c) => !EXCLUDED_FROM_TOTAL.has(c.key));
  const tTaken = counted.reduce((s, c) => s + c.taken, 0);
  const tCap = counted.reduce((s, c) => s + c.cap, 0);
  return {
    event: eventName,
    updated_at: new Date().toISOString(),
    classes,
    totals: { taken: tTaken, cap: tCap, left: left(tCap, tTaken) },
  };
}

/** Returns null when the event doesn't exist or isn't linked to Entry Ninja. */
export async function getClassAvailability(supabase: AnyClient, eventId: string): Promise<ClassAvailability | null> {
  const { data: ev } = await supabase.from("events").select("id, name, entry_ninja_id").eq("id", eventId).maybeSingle();
  if (!ev || !ev.entry_ninja_id) return null;

  const cacheKey = `class_availability:${eventId}`;
  const { data: cached } = await supabase.from("site_settings").select("value, updated_at").eq("key", cacheKey).maybeSingle();
  const cachedValue = cached?.value as ClassAvailability | undefined;
  if (cachedValue?.updated_at && Date.now() - new Date(cachedValue.updated_at).getTime() < TTL_MS) {
    return { ...cachedValue, event: ev.name };
  }

  try {
    const fresh = await buildFromEntryNinja(Number(ev.entry_ninja_id), ev.name);
    await supabase.from("site_settings").upsert({ key: cacheKey, value: fresh as never }, { onConflict: "key" });
    return fresh;
  } catch (err) {
    console.error("[class-availability] Entry Ninja refresh failed", err);
    if (cachedValue) return { ...cachedValue, event: ev.name }; // serve stale rather than fail
    throw err;
  }
}
