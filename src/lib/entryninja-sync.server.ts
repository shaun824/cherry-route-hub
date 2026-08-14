// Server-only: shared Entry Ninja -> app sync used by the admin action and the cron hook.
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchEnEvents, fetchEnEntries, normaliseSize, toLineArray, linePrice, type EnEvent } from "./entryninja.server";
import { hashIdNumber, idNumberLast4 } from "./id-hash.server";

// The generated Database type isn't needed here; the callers pass typed clients.
type AnyClient = SupabaseClient<any, any, any>;

export type SyncResult = {
  eventId: string;
  eventName: string;
  createdEvent: boolean;
  totalEntries: number;
  created: number;
  updated: number;
  linked: number;
  skipped: number;
  errors: string[];
};

export async function resolveOrCreateEvent(
  supabase: AnyClient,
  enEvent: EnEvent,
  explicitEventId?: string,
): Promise<{ eventId: string; createdEvent: boolean }> {
  let eventId = explicitEventId ?? null;
  let createdEvent = false;
  if (!eventId) {
    const { data: existing } = await supabase.from("events").select("id, name, entry_ninja_id");
    const match =
      (existing ?? []).find((e: any) => String(e.entry_ninja_id ?? "") === String(enEvent.id)) ??
      (existing ?? []).find(
        (e: any) => String(e.name).trim().toLowerCase() === enEvent.name.trim().toLowerCase(),
      );
    eventId = match?.id ?? null;
  }
  if (!eventId) {
    const { data: ins, error: insErr } = await supabase
      .from("events")
      .insert({
        name: enEvent.name,
        discipline: "Cycling",
        event_date: enEvent.date ?? new Date().toISOString(),
        location: [enEvent.venue?.name, enEvent.venue?.city].filter(Boolean).join(", ") || "TBC",
        distance_km: 0,
        status: "upcoming",
        lifecycle: "draft",
        schedule: [],
        classes: [],
        batches: [],
        days: [],
        social_links: {},
        auto_created: true,
        entry_ninja_id: String(enEvent.id),
      })
      .select("id")
      .single();
    if (insErr || !ins) throw insErr ?? new Error("Could not create the event.");
    eventId = ins.id as string;
    createdEvent = true;
  } else {
    await supabase.from("events").update({ entry_ninja_id: String(enEvent.id) }).eq("id", eventId);
  }
  return { eventId, createdEvent };
}

export async function syncEnEvent(
  supabase: AnyClient,
  opts: { enEventId: number; eventId?: string },
): Promise<SyncResult> {
  const enEvents = await fetchEnEvents();
  const enEvent = enEvents.find((e) => e.id === opts.enEventId);
  if (!enEvent) throw new Error("That event isn't available on your Entry Ninja account.");

  const { eventId, createdEvent } = await resolveOrCreateEvent(supabase, enEvent, opts.eventId);
  const entries = await fetchEnEntries(enEvent.id);

  let created = 0;
  let updated = 0;
  let linked = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    const p = entry.entrant;
    const email = (p?.email ?? "").trim().toLowerCase();
    const fullName = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim();
    const idNumber = (p?.id_number ?? "").trim();
    // Riders without an email are still imported and keyed on their ID number;
    // the email is filled in when they sign in and claim the entry.
    if (!fullName || (!email && idNumber.length < 4)) {
      skipped++;
      continue;
    }
    try {
      let jacket: string | null = null;
      let tshirt: string | null = null;
      const extras: { name: string; qty: number; size?: string; price?: number }[] = [];
      const lines = [...toLineArray(entry.merchandise), ...toLineArray(entry.extra)];
      for (const line of lines) {
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


      const idHash = idNumber.length >= 4 ? hashIdNumber(idNumber) : null;

      // Match on ID number first (stable), then email.
      let existingId: string | null = null;
      if (idHash) {
        const { data: byId, error: byIdErr } = await supabase
          .from("entrants")
          .select("id")
          .eq("id_number_hash", idHash)
          .maybeSingle();
        if (byIdErr) throw byIdErr;
        existingId = byId?.id ?? null;
      }
      if (!existingId && email) {
        const { data: byEmail, error: findErr } = await supabase
          .from("entrants")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        if (findErr) throw findErr;
        existingId = byEmail?.id ?? null;
      }

      const entrantPayload = {
        full_name: fullName,
        phone: p?.cell_phone_number || null,
        ...(idHash ? { id_number_hash: idHash, id_number_last4: idNumberLast4(idNumber) } : {}),
        // Never wipe an email a rider has already supplied in the app.
        ...(email ? { email } : {}),
      };

      let entrantId: string;
      if (existingId) {
        entrantId = existingId;
        await supabase.from("entrants").update(entrantPayload).eq("id", entrantId);
        updated++;
      } else {
        const { data: ins, error: insErr } = await supabase
          .from("entrants")
          .insert({ email: email || null, ...entrantPayload })
          .select("id")
          .single();
        if (insErr || !ins) throw insErr ?? new Error("insert failed");
        entrantId = ins.id as string;
        created++;
      }


      const { error: eeErr } = await supabase.from("event_entrants").upsert(
        {
          event_id: eventId,
          entrant_id: entrantId,
          category: entry.class?.name ?? null,
          batch: entry.batch?.name ?? null,
          bib_number: entry.race_number || null,
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
      if (eeErr) throw eeErr;
      linked++;
    } catch (err) {
      if (errors.length < 20) errors.push(`${fullName || email}: ${(err as Error).message}`);
    }
  }

  return {
    eventId,
    eventName: enEvent.name,
    createdEvent,
    totalEntries: entries.length,
    created,
    updated,
    linked,
    skipped,
    errors,
  };
}

// Syncs every Entry Ninja event that is already linked to a local event.
export async function syncAllLinkedEvents(supabase: AnyClient) {
  const enEvents = await fetchEnEvents();
  const { data: local } = await supabase.from("events").select("id, name, entry_ninja_id");
  const byExternal = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const e of (local ?? []) as any[]) {
    if (e.entry_ninja_id) byExternal.set(String(e.entry_ninja_id), e.id);
    if (e.name) byName.set(String(e.name).trim().toLowerCase(), e.id);
  }

  const results: (Pick<SyncResult, "eventName" | "totalEntries" | "created" | "updated" | "linked"> & {
    ok: boolean;
    error?: string;
  })[] = [];

  for (const en of enEvents) {
    const eventId = byExternal.get(String(en.id)) ?? byName.get(en.name.trim().toLowerCase());
    if (!eventId) continue; // only refresh events already linked in the app
    try {
      const r = await syncEnEvent(supabase, { enEventId: en.id, eventId });
      results.push({
        ok: true,
        eventName: r.eventName,
        totalEntries: r.totalEntries,
        created: r.created,
        updated: r.updated,
        linked: r.linked,
      });
    } catch (err) {
      results.push({
        ok: false,
        eventName: en.name,
        totalEntries: 0,
        created: 0,
        updated: 0,
        linked: 0,
        error: (err as Error).message,
      });
    }
  }

  return { events: results.length, results };
}
