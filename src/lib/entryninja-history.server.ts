// Server-only: scan Entry Ninja for a rider's entries and store them as
// their personal event history.
import { fetchEnEvents, fetchEnEntries, type EnEntry } from "./entryninja.server";
import { hashIdNumber } from "./id-hash.server";
import { normalizeName, surnameMatches } from "./id-lookup.server";

type Sb = {
  from: (t: string) => any;
};

const MAX_EVENTS = 250;
const CONCURRENCY = 5;

function cleanId(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length) as R[];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function syncRiderHistory(args: {
  supabase: Sb;
  userId: string;
  email: string | null;
  idNumber?: string;
  surname?: string;
}): Promise<{
  ok: boolean;
  matched: number;
  saved: number;
  eventsScanned: number;
  reason?: "no_identity" | "api_error";
  error?: string;
}> {
  const { supabase, userId } = args;

  // Build the identity set: login email, any roster emails/ID hashes already
  // linked to this account, plus an ID number typed by the rider now.
  const emails = new Set<string>();
  if (args.email) emails.add(args.email.toLowerCase());
  const idHashes = new Set<string>();
  const names = new Set<string>();

  const typedId = cleanId(args.idNumber);
  if (typedId.length >= 4) idHashes.add(hashIdNumber(typedId));

  const { data: myEntrants } = await supabase
    .from("entrants")
    .select("email, id_number_hash, full_name")
    .eq("user_id", userId);
  for (const e of (myEntrants ?? []) as {
    email: string | null;
    id_number_hash: string | null;
    full_name: string | null;
  }[]) {
    if (e.email) emails.add(e.email.toLowerCase());
    if (e.id_number_hash) idHashes.add(e.id_number_hash);
    if (e.full_name) names.add(normalizeName(e.full_name));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.email) emails.add(String(profile.email).toLowerCase());
  if (profile?.full_name) names.add(normalizeName(String(profile.full_name)));

  if (emails.size === 0 && idHashes.size === 0) {
    return { ok: false, matched: 0, saved: 0, eventsScanned: 0, reason: "no_identity" };
  }

  const surname = (args.surname ?? "").trim();

  let enEvents;
  try {
    enEvents = await fetchEnEvents();
  } catch (err) {
    return { ok: false, matched: 0, saved: 0, eventsScanned: 0, reason: "api_error", error: (err as Error).message };
  }

  const sorted = [...enEvents]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, MAX_EVENTS);

  // Local events keyed by Entry Ninja id so history rows can deep-link.
  const { data: localEvents } = await supabase.from("events").select("id, entry_ninja_id");
  const localByEn = new Map<string, string>();
  for (const e of (localEvents ?? []) as { id: string; entry_ninja_id: string | number | null }[]) {
    if (e.entry_ninja_id != null) localByEn.set(String(e.entry_ninja_id), e.id);
  }

  const matches: {
    user_id: string;
    en_event_id: number;
    event_id: string | null;
    event_name: string;
    event_date: string | null;
    venue: string | null;
    category: string | null;
    bib_number: string | null;
    registration_ref: string | null;
    paid: boolean | null;
    matched_on: string;
    synced_at: string;
  }[] = [];

  const now = new Date().toISOString();

  await mapLimit(sorted, CONCURRENCY, async (ev) => {
    let entries: EnEntry[] = [];
    try {
      entries = await fetchEnEntries(ev.id);
    } catch {
      return;
    }
    for (const entry of entries) {
      const ent = entry.entrant;
      if (!ent) continue;
      const entEmail = (ent.email ?? "").trim().toLowerCase();
      const entIdRaw = cleanId(ent.id_number);
      const entIdHash = entIdRaw.length >= 4 ? hashIdNumber(entIdRaw) : null;

      let matchedOn: string | null = null;
      if (entEmail && emails.has(entEmail)) matchedOn = "email";
      else if (entIdHash && idHashes.has(entIdHash)) matchedOn = "id_number";
      else if (surname.length >= 2 && typedId.length >= 4 && entIdRaw === typedId) {
        const fullName = `${ent.first_name ?? ""} ${ent.last_name ?? ""}`.trim();
        if (surnameMatches(fullName, surname)) matchedOn = "id_number";
      }
      if (!matchedOn) continue;

      matches.push({
        user_id: userId,
        en_event_id: ev.id,
        event_id: localByEn.get(String(ev.id)) ?? null,
        event_name: ev.name,
        event_date: ev.date ?? null,
        venue: ev.venue?.name ?? [ev.venue?.city, ev.venue?.province].filter(Boolean).join(", ") ?? null,
        category: entry.class?.name ?? null,
        bib_number: entry.race_number ?? null,
        registration_ref: entry.registration_reference ?? null,
        paid: entry.paid ?? null,
        matched_on: matchedOn,
        synced_at: now,
      });
      break; // one row per event
    }
  });

  let saved = 0;
  if (matches.length) {
    const { error } = await supabase
      .from("rider_event_history")
      .upsert(matches, { onConflict: "user_id,en_event_id" });
    if (error) {
      return {
        ok: false,
        matched: matches.length,
        saved: 0,
        eventsScanned: sorted.length,
        reason: "api_error",
        error: error.message,
      };
    }
    saved = matches.length;
  }

  return { ok: true, matched: matches.length, saved, eventsScanned: sorted.length };
}
