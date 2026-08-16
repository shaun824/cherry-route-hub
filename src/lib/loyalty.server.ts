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

/* ------------------------ price-based event valuing ----------------------- */

/**
 * Work out an entry price per Entry Ninja event from what riders were charged
 * (event_entrants.amount_due_cents), then convert it into loyalty points.
 */
export async function applyPriceBasedValues(
  supabase: Sb,
): Promise<{ priced: number; updated: number; skipped: number }> {
  const { pointsFromPrice } = await import("./loyalty");
  const settings = await loadLoyaltySettings(supabase);

  const { data: values } = await supabase
    .from("loyalty_event_values")
    .select("id, en_event_id, event_id, entry_price_cents, hero, points");
  const rows = (values ?? []) as {
    id: string;
    en_event_id: number;
    event_id: string | null;
    entry_price_cents: number | null;
    hero: boolean;
    points: number;
  }[];

  // Median amount charged per local event, used when no price is captured yet.
  const priceByEvent = new Map<string, number>();
  const eventIds = rows.map((r) => r.event_id).filter(Boolean) as string[];
  if (eventIds.length) {
    const amounts = new Map<string, number[]>();
    for (const batch of chunk(eventIds, 50)) {
      const { data } = await supabase
        .from("event_entrants")
        .select("event_id, amount_due_cents")
        .in("event_id", batch)
        .not("amount_due_cents", "is", null);
      for (const r of (data ?? []) as { event_id: string; amount_due_cents: number }[]) {
        if (!r.amount_due_cents || r.amount_due_cents <= 0) continue;
        const list = amounts.get(r.event_id) ?? [];
        list.push(r.amount_due_cents);
        amounts.set(r.event_id, list);
      }
    }
    for (const [id, list] of amounts) {
      list.sort((a, b) => a - b);
      priceByEvent.set(id, list[Math.floor(list.length / 2)] as number);
    }
  }

  let priced = 0;
  let updated = 0;
  let skipped = 0;

  for (const r of rows) {
    const derived = r.entry_price_cents ?? (r.event_id ? (priceByEvent.get(r.event_id) ?? null) : null);
    if (!derived) {
      skipped++;
      continue;
    }
    priced++;
    const points = pointsFromPrice(derived, r.hero, settings);
    if (points === r.points && r.entry_price_cents === derived) continue;
    const { error } = await supabase
      .from("loyalty_event_values")
      .update({
        points,
        entry_price_cents: derived,
        price_source: r.entry_price_cents ? "manual" : "entry-ninja",
      })
      .eq("id", r.id);
    if (!error) updated++;
  }

  return { priced, updated, skipped };
}

/* ---------------------- coupon push-back to Entry Ninja -------------------- */

/**
 * Try to register a redeemed coupon as a discount code on Entry Ninja. Their
 * API doesn't expose discount codes for every organiser, so a rejection is
 * recorded as "manual" rather than failing the rider's redemption.
 */
export async function pushCouponToEntryNinja(
  supabase: Sb,
  couponId: string,
): Promise<{ status: string; message: string }> {
  const { data: coupon } = await supabase
    .from("loyalty_coupons")
    .select("id, code, reward_name, points_spent, expires_at, en_event_id")
    .eq("id", couponId)
    .maybeSingle();
  if (!coupon) return { status: "error", message: "Coupon not found." };

  const settings = await loadLoyaltySettings(supabase);
  const valueRand = Math.round(Number(coupon.points_spent) * settings.randPerPoint);

  let status = "sent";
  let message = `Code ${coupon.code} registered on Entry Ninja.`;
  let ref: string | null = null;
  let err: string | null = null;

  try {
    const { enPost } = await import("./entryninja.server");
    const res = await enPost("/api/discount-codes", {
      code: coupon.code,
      description: `${settings.programName}: ${coupon.reward_name}`,
      amount: valueRand,
      type: "fixed",
      usage_limit: 1,
      expires_at: coupon.expires_at,
      event_id: coupon.en_event_id ?? undefined,
    });
    if (res.ok) {
      ref = String(res.json?.data?.id ?? res.json?.id ?? "");
    } else {
      status = "manual";
      err = `Entry Ninja responded ${res.status}: ${res.text}`;
      message = `Entry Ninja didn't accept the code automatically — load ${coupon.code} for R${valueRand} manually.`;
    }
  } catch (e) {
    status = "manual";
    err = (e as Error).message;
    message = `Could not reach Entry Ninja — load ${coupon.code} for R${valueRand} manually.`;
  }

  await supabase
    .from("loyalty_coupons")
    .update({ en_status: status, en_ref: ref, en_error: err, en_pushed_at: new Date().toISOString() })
    .eq("id", couponId);

  return { status, message };
}

/* ------------------------------ point expiry ------------------------------ */

/**
 * Miles expire after a spell of inactivity. Any rider whose most recent ledger
 * activity is older than the configured window has their positive balance
 * written off with a negative "expire" row, so the ledger stays the single
 * source of truth.
 */
export async function expireIdlePoints(
  supabase: Sb,
): Promise<{ riders: number; pointsExpired: number; cutoff: string | null }> {
  const settings = await loadLoyaltySettings(supabase);
  if (!settings.expiryMonths || settings.expiryMonths <= 0) {
    return { riders: 0, pointsExpired: 0, cutoff: null };
  }
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - settings.expiryMonths);

  const totals = new Map<string, number>();
  const lastSeen = new Map<string, number>();
  for (let page = 0; page < 100; page++) {
    const { data } = await supabase
      .from("loyalty_ledger")
      .select("entrant_id, points, created_at")
      .range(page * 1000, page * 1000 + 999);
    const rows = (data ?? []) as { entrant_id: string; points: number; created_at: string }[];
    for (const r of rows) {
      totals.set(r.entrant_id, (totals.get(r.entrant_id) ?? 0) + Number(r.points));
      const when = new Date(r.created_at).getTime();
      if (when > (lastSeen.get(r.entrant_id) ?? 0)) lastSeen.set(r.entrant_id, when);
    }
    if (rows.length < 1000) break;
  }

  const inserts: { entrant_id: string; points: number; kind: string; reason: string }[] = [];
  for (const [entrantId, balance] of totals) {
    if (balance <= 0) continue;
    if ((lastSeen.get(entrantId) ?? 0) > cutoff.getTime()) continue;
    inserts.push({
      entrant_id: entrantId,
      points: -balance,
      kind: "expire",
      reason: `Expired after ${settings.expiryMonths} months of inactivity`,
    });
  }

  let expired = 0;
  for (const batch of chunk(inserts, 500)) {
    const { error } = await supabase.from("loyalty_ledger").insert(batch);
    if (error) throw new Error(error.message);
    expired += batch.reduce((s, r) => s + Math.abs(r.points), 0);
  }

  return { riders: inserts.length, pointsExpired: expired, cutoff: cutoff.toISOString() };
}
