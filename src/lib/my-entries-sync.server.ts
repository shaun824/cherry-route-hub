// Server-only: pull just ONE rider's Entry Ninja entries into the local roster.
// Used for the "I've just entered" instant refresh — far cheaper than a full sync.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchEnEvents,
  fetchEnEntries,
  normaliseSize,
  toLineArray,
  linePrice,
  extractTeam,
  type EnEntry,
} from "./entryninja.server";
import { hashIdNumber, idNumberLast4 } from "./id-hash.server";

type AnyClient = SupabaseClient<any, any, any>;

const MAX_EVENTS = 20;
const CONCURRENCY = 4;

function cleanId(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, "").toUpperCase();
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= items.length) return;
        await fn(items[i] as T);
      }
    }),
  );
}

export type MyEntriesSyncResult = {
  ok: boolean;
  found: number;
  saved: number;
  eventsScanned: number;
  reason?: "no_identity" | "api_error";
  error?: string;
};

export async function syncMyEntries(args: {
  admin: AnyClient;
  userId: string;
  email: string | null;
}): Promise<MyEntriesSyncResult> {
  const { admin, userId } = args;

  const emails = new Set<string>();
  if (args.email) emails.add(args.email.toLowerCase());
  const idHashes = new Set<string>();

  const { data: myEntrants } = await admin
    .from("entrants")
    .select("id, email, id_number_hash")
    .eq("user_id", userId);
  const entrantIds: string[] = [];
  for (const e of (myEntrants ?? []) as {
    id: string;
    email: string | null;
    id_number_hash: string | null;
  }[]) {
    entrantIds.push(e.id);
    if (e.email) emails.add(e.email.toLowerCase());
    if (e.id_number_hash) idHashes.add(e.id_number_hash);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name, phone")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.email) emails.add(String(profile.email).toLowerCase());

  if (emails.size === 0 && idHashes.size === 0) {
    return { ok: false, found: 0, saved: 0, eventsScanned: 0, reason: "no_identity" };
  }

  // Only look at events that are still open / upcoming — that's where a brand
  // new entry can appear. Page 1 of the Entry Ninja events feed is exactly that.
  let openEvents;
  try {
    openEvents = await fetchEnEvents(1);
  } catch (err) {
    return { ok: false, found: 0, saved: 0, eventsScanned: 0, reason: "api_error", error: (err as Error).message };
  }

  const { data: localEvents } = await admin
    .from("events")
    .select("id, entry_ninja_id, event_date")
    .not("entry_ninja_id", "is", null);
  const localByEn = new Map<string, string>();
  for (const e of (localEvents ?? []) as { id: string; entry_ninja_id: string | null }[]) {
    if (e.entry_ninja_id) localByEn.set(String(e.entry_ninja_id), e.id);
  }

  // Scan the open Entry Ninja events that we actually mirror locally.
  const candidates = openEvents.filter((e) => localByEn.has(String(e.id))).slice(0, MAX_EVENTS);

  let found = 0;
  let saved = 0;

  await mapLimit(candidates, CONCURRENCY, async (ev) => {
    let entries: EnEntry[] = [];
    try {
      entries = await fetchEnEntries(ev.id);
    } catch {
      return;
    }
    const eventId = localByEn.get(String(ev.id));
    if (!eventId) return;

    for (const entry of entries) {
      const p = entry.entrant;
      if (!p) continue;
      const entEmail = (p.email ?? "").trim().toLowerCase();
      const entIdRaw = cleanId(p.id_number);
      const entIdHash = entIdRaw.length >= 4 ? hashIdNumber(entIdRaw) : null;
      const isMe = (entEmail && emails.has(entEmail)) || (entIdHash && idHashes.has(entIdHash));
      if (!isMe) continue;
      found++;

      const fullName = [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Rider";

      // Find (or create) the roster record for this person and keep it linked
      // to the signed-in account.
      let entrantId: string | null = null;
      if (entIdHash) {
        const { data } = await admin
          .from("entrants")
          .select("id")
          .eq("id_number_hash", entIdHash)
          .maybeSingle();
        entrantId = data?.id ?? null;
      }
      if (!entrantId && entEmail) {
        const { data } = await admin.from("entrants").select("id").ilike("email", entEmail).maybeSingle();
        entrantId = data?.id ?? null;
      }
      if (!entrantId && entrantIds.length) entrantId = entrantIds[0] ?? null;

      const payload = {
        full_name: fullName,
        user_id: userId,
        ...(p.cell_phone_number ? { phone: p.cell_phone_number } : {}),
        ...(entEmail ? { email: entEmail } : {}),
        ...(entIdHash ? { id_number_hash: entIdHash, id_number_last4: idNumberLast4(entIdRaw) } : {}),
      };

      if (entrantId) {
        await admin.from("entrants").update(payload).eq("id", entrantId);
      } else {
        const { data: ins } = await admin.from("entrants").insert(payload).select("id").single();
        entrantId = (ins?.id as string) ?? null;
      }
      if (!entrantId) break;
      if (!entrantIds.includes(entrantId)) entrantIds.push(entrantId);

      let jacket: string | null = null;
      let tshirt: string | null = null;
      const extras: { name: string; qty: number; size?: string; price?: number }[] = [];
      for (const line of [...toLineArray(entry.merchandise), ...toLineArray(entry.extra)]) {
        const itemName = (line?.item?.name ?? "").trim();
        if (!itemName) continue;
        const option = line?.option?.name ?? null;
        const size = normaliseSize(option);
        const lower = itemName.toLowerCase();
        if (size && lower.includes("jacket")) jacket = size;
        else if (size && (lower.includes("shirt") || lower.includes("tee"))) tshirt = size;
        const price = linePrice(line);
        extras.push({
          name: itemName,
          qty: Number(line?.quantity ?? 1) || 1,
          ...(option ? { size: option } : {}),
          ...(price != null ? { price } : {}),
        });
      }

      const team = extractTeam(entry);
      const { error } = await admin.from("event_entrants").upsert(
        {
          event_id: eventId,
          entrant_id: entrantId,
          category: entry.class?.name ?? null,
          batch: entry.batch?.name ?? null,
          bib_number: entry.race_number || null,
          team_name: team.name,
          team_ref: team.ref,
          external_id: String(entry.id),
          registration_ref: entry.registration_reference || null,
          jacket_size: jacket,
          tshirt_size: tshirt,
          extras,
          paid: typeof entry.paid === "boolean" ? entry.paid : null,
          payment_synced_at: new Date().toISOString(),
          notes: entry.paid === false ? "Payment outstanding on Entry Ninja" : null,
        },
        { onConflict: "event_id,entrant_id" },
      );
      if (!error) saved++;
      break; // one entry per event
    }
  });

  return { ok: true, found, saved, eventsScanned: candidates.length };
}
