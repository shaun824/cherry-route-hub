// Server-only loyalty engine: backfill riders from Entry Ninja, value events,
// recalculate the points ledger and mint coupon codes.
import { randomBytes } from "crypto";
import { fetchEnEvents, fetchEnEntries } from "./entryninja.server";
import { hashIdNumber, idNumberLast4 } from "./id-hash.server";
import { DEFAULT_LOYALTY_SETTINGS, parseLoyaltySettings, type LoyaltySettings } from "./loyalty";

type Sb = { from: (t: string) => any };

const CONCURRENCY = 4;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length) as R[];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await fn(items[i] as T);
      }
    }),
  );
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function loadLoyaltySettings(supabase: Sb): Promise<LoyaltySettings> {
  const { data } = await supabase.from("site_settings").select("value").eq("key", "loyalty").maybeSingle();
  return parseLoyaltySettings(data?.value ?? DEFAULT_LOYALTY_SETTINGS);
}

export async function saveLoyaltySettings(supabase: Sb, settings: LoyaltySettings) {
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: "loyalty", value: settings }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  return settings;
}

/** Pull every Entry Ninja event + entrant and build people + participation rows. */
export async function backfillLoyalty(
  supabase: Sb,
  opts: { sinceYear?: number; maxEvents?: number; enEventId?: number } = {},
): Promise<{
  eventsScanned: number;
  entriesSeen: number;
  peopleCreated: number;
  peopleMatched: number;
  participationAdded: number;
  skipped: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const settings = await loadLoyaltySettings(supabase);

  let enEvents = await fetchEnEvents();
  if (opts.enEventId) enEvents = enEvents.filter((e) => e.id === opts.enEventId);
  if (opts.sinceYear) {
    enEvents = enEvents.filter((e) => !e.date || Number(String(e.date).slice(0, 4)) >= (opts.sinceYear as number));
  }
  enEvents = enEvents
    .filter((e) => !e.date || new Date(e.date).getTime() <= Date.now())
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, opts.maxEvents ?? 60);

  // Local event ids so participation rows can deep-link.
  const { data: localEvents } = await supabase.from("events").select("id, entry_ninja_id");
  const localByEn = new Map<string, string>();
  for (const e of (localEvents ?? []) as { id: string; entry_ninja_id: string | number | null }[]) {
    if (e.entry_ninja_id != null) localByEn.set(String(e.entry_ninja_id), e.id);
  }

  // Make sure every event has a value row (defaults applied).
  const valueRows = enEvents.map((e) => ({
    en_event_id: e.id,
    event_id: localByEn.get(String(e.id)) ?? null,
    event_name: e.name,
    event_date: e.date ? String(e.date).slice(0, 10) : null,
    points: settings.defaultPoints,
  }));
  for (const batch of chunk(valueRows, 200)) {
    await supabase.from("loyalty_event_values").upsert(batch, { onConflict: "en_event_id", ignoreDuplicates: true });
  }

  // Existing people, keyed by id hash and email.
  const byHash = new Map<string, string>();
  const byEmail = new Map<string, string>();
  for (let page = 0; page < 40; page++) {
    const { data } = await supabase
      .from("entrants")
      .select("id, email, id_number_hash")
      .range(page * 1000, page * 1000 + 999);
    const rows = (data ?? []) as { id: string; email: string | null; id_number_hash: string | null }[];
    for (const r of rows) {
      if (r.id_number_hash) byHash.set(r.id_number_hash, r.id);
      if (r.email) byEmail.set(r.email.toLowerCase(), r.id);
    }
    if (rows.length < 1000) break;
  }

  let entriesSeen = 0;
  let peopleCreated = 0;
  let peopleMatched = 0;
  let participationAdded = 0;
  let skipped = 0;

  const eventPayloads = await mapLimit(enEvents, CONCURRENCY, async (ev) => {
    try {
      return { ev, entries: await fetchEnEntries(ev.id) };
    } catch (err) {
      errors.push(`${ev.name}: ${(err as Error).message}`);
      return { ev, entries: [] };
    }
  });

  for (const { ev, entries } of eventPayloads) {
    entriesSeen += entries.length;
    const participation: {
      entrant_id: string;
      en_event_id: number;
      event_id: string | null;
      event_name: string;
      event_date: string | null;
      category: string | null;
    }[] = [];

    // Create any people we've never seen before, one event at a time.
    const pendingNew: {
      key: string;
      row: {
        full_name: string;
        email: string | null;
        id_number_hash: string | null;
        id_number_last4: string | null;
        phone: string | null;
      };
    }[] = [];
    const resolved: { key: string; entrantId: string | null; category: string | null }[] = [];

    for (const entry of entries) {
      const person = entry.entrant;
      const fullName = [person?.first_name, person?.last_name].filter(Boolean).join(" ").trim();
      const email = (person?.email ?? "").trim().toLowerCase() || null;
      const idNum = (person?.id_number ?? "").replace(/\s+/g, "").toUpperCase();
      const hash = idNum.length >= 4 ? hashIdNumber(idNum) : null;
      if (!fullName && !email && !hash) {
        skipped++;
        continue;
      }
      const key = hash ?? email ?? `name:${fullName.toLowerCase()}`;
      const existing = (hash && byHash.get(hash)) || (email && byEmail.get(email)) || null;
      if (existing) {
        peopleMatched++;
        resolved.push({ key, entrantId: existing, category: entry.class?.name ?? null });
      } else if (!pendingNew.some((p) => p.key === key)) {
        pendingNew.push({
          key,
          row: {
            full_name: fullName || email || "Unknown rider",
            email,
            id_number_hash: hash,
            id_number_last4: idNum ? idNumberLast4(idNum) : null,
            phone: person?.cell_phone_number ?? null,
          },
        });
        resolved.push({ key, entrantId: null, category: entry.class?.name ?? null });
      } else {
        resolved.push({ key, entrantId: null, category: entry.class?.name ?? null });
      }
    }

    const createdByKey = new Map<string, string>();
    for (const batch of chunk(pendingNew, 200)) {
      const { data, error } = await supabase
        .from("entrants")
        .insert(batch.map((b) => b.row))
        .select("id, email, id_number_hash");
      if (error) {
        errors.push(`${ev.name}: ${error.message}`);
        continue;
      }
      const rows = (data ?? []) as { id: string; email: string | null; id_number_hash: string | null }[];
      rows.forEach((r, i) => {
        const key = batch[i]?.key as string;
        createdByKey.set(key, r.id);
        if (r.id_number_hash) byHash.set(r.id_number_hash, r.id);
        if (r.email) byEmail.set(r.email.toLowerCase(), r.id);
      });
      peopleCreated += rows.length;
    }

    for (const r of resolved) {
      const entrantId = r.entrantId ?? createdByKey.get(r.key) ?? null;
      if (!entrantId) {
        skipped++;
        continue;
      }
      if (participation.some((p) => p.entrant_id === entrantId)) continue;
      participation.push({
        entrant_id: entrantId,
        en_event_id: ev.id,
        event_id: localByEn.get(String(ev.id)) ?? null,
        event_name: ev.name,
        event_date: ev.date ? String(ev.date).slice(0, 10) : null,
        category: r.category,
      });
    }

    for (const batch of chunk(participation, 500)) {
      const { error } = await supabase
        .from("loyalty_participation")
        .upsert(batch, { onConflict: "entrant_id,en_event_id", ignoreDuplicates: true });
      if (error) errors.push(`${ev.name}: ${error.message}`);
      else participationAdded += batch.length;
    }
  }

  return {
    eventsScanned: enEvents.length,
    entriesSeen,
    peopleCreated,
    peopleMatched,
    participationAdded,
    skipped,
    errors: errors.slice(0, 20),
  };
}

/** Rebuild every "earn" ledger row from participation + current event values. */
export async function recalculateLedger(supabase: Sb): Promise<{ riders: number; rows: number; points: number }> {
  const settings = await loadLoyaltySettings(supabase);

  const { data: values } = await supabase.from("loyalty_event_values").select("en_event_id, points, event_name");
  const pointsByEvent = new Map<number, { points: number; name: string }>();
  for (const v of (values ?? []) as { en_event_id: number; points: number; event_name: string }[]) {
    pointsByEvent.set(v.en_event_id, { points: v.points, name: v.event_name });
  }

  const participation: {
    entrant_id: string;
    en_event_id: number;
    event_name: string;
    event_date: string | null;
  }[] = [];
  for (let page = 0; page < 100; page++) {
    const { data } = await supabase
      .from("loyalty_participation")
      .select("entrant_id, en_event_id, event_name, event_date")
      .order("en_event_id")
      .range(page * 1000, page * 1000 + 999);
    const rows = (data ?? []) as typeof participation;
    participation.push(...rows);
    if (rows.length < 1000) break;
  }

  // Returning-rider bonus: +bonus for each event beyond the first, capped per rider.
  const seenByRider = new Map<string, number>();
  const inserts: {
    entrant_id: string;
    points: number;
    kind: string;
    en_event_id: number;
    reason: string;
  }[] = [];
  let total = 0;

  for (const p of participation.sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""))) {
    const cfg = pointsByEvent.get(p.en_event_id);
    const base = cfg?.points ?? settings.defaultPoints;
    if (base <= 0) continue;
    const prior = seenByRider.get(p.entrant_id) ?? 0;
    seenByRider.set(p.entrant_id, prior + 1);
    const bonus = Math.min(prior, 8) * settings.loyaltyBonusPerYear;
    const points = base + bonus;
    total += points;
    inserts.push({
      entrant_id: p.entrant_id,
      points,
      kind: "earn",
      en_event_id: p.en_event_id,
      reason: bonus > 0 ? `${p.event_name} (+${bonus} returning rider)` : p.event_name,
    });
  }

  // Wipe and rebuild earned rows only — redemptions and manual adjustments stay.
  await supabase.from("loyalty_ledger").delete().eq("kind", "earn");
  for (const batch of chunk(inserts, 500)) {
    const { error } = await supabase.from("loyalty_ledger").insert(batch);
    if (error) throw new Error(error.message);
  }

  return { riders: seenByRider.size, rows: inserts.length, points: total };
}

export function generateCouponCode(prefix = "RC"): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let body = "";
  for (let i = 0; i < 8; i++) {
    body += alphabet[(bytes[i] as number) % alphabet.length];
    if (i === 3) body += "-";
  }
  return `${prefix}-${body}`;
}
