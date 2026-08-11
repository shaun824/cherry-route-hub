// Admin-only server functions that sync entries from Entry Ninja.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listEntryNinjaEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Forbidden");

    const { fetchEnEvents } = await import("./entryninja.server");
    const [enEvents, local] = await Promise.all([
      fetchEnEvents(),
      context.supabase.from("events").select("id, name, entry_ninja_id"),
    ]);

    const byExternal = new Map<string, { id: string; name: string }>();
    const byName = new Map<string, { id: string; name: string }>();
    for (const e of local.data ?? []) {
      if (e.entry_ninja_id) byExternal.set(String(e.entry_ninja_id), { id: e.id, name: e.name });
      if (e.name) byName.set(e.name.trim().toLowerCase(), { id: e.id, name: e.name });
    }

    return enEvents
      .map((e) => {
        const match = byExternal.get(String(e.id)) ?? byName.get(e.name.trim().toLowerCase()) ?? null;
        return {
          enId: e.id,
          name: e.name,
          date: e.date ?? null,
          venue: e.venue?.name ?? null,
          location: [e.venue?.city, e.venue?.province].filter(Boolean).join(", ") || null,
          matchedEventId: match?.id ?? null,
          matchedEventName: match?.name ?? null,
        };
      })
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  });

const syncSchema = z.object({
  enEventId: z.number().int().positive(),
  eventId: z.string().uuid().optional(),
});

export const syncEntryNinjaEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => syncSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Forbidden");

    const { fetchEnEvents, fetchEnEntries, normaliseSize } = await import("./entryninja.server");
    const { hashIdNumber, idNumberLast4 } = await import("./id-hash.server");
    const supabase = context.supabase;

    const enEvents = await fetchEnEvents();
    const enEvent = enEvents.find((e) => e.id === data.enEventId);
    if (!enEvent) throw new Error("That event isn't available on your Entry Ninja account.");

    // Resolve the local event: explicit choice → external id → name → new stub.
    let eventId = data.eventId ?? null;
    let createdEvent = false;
    if (!eventId) {
      const { data: existing } = await supabase
        .from("events")
        .select("id, name, entry_ninja_id");
      const match =
        (existing ?? []).find((e) => String(e.entry_ninja_id ?? "") === String(enEvent.id)) ??
        (existing ?? []).find((e) => e.name.trim().toLowerCase() === enEvent.name.trim().toLowerCase());
      eventId = match?.id ?? null;
    }
    if (!eventId) {
      const { data: ins, error: insErr } = await supabase
        .from("events")
        .insert({
          name: enEvent.name,
          discipline: "Cycling",
          event_date: enEvent.date ?? new Date().toISOString(),
          location:
            [enEvent.venue?.name, enEvent.venue?.city].filter(Boolean).join(", ") || "TBC",
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
      eventId = ins.id;
      createdEvent = true;
    } else {
      await supabase.from("events").update({ entry_ninja_id: String(enEvent.id) }).eq("id", eventId);
    }

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
      if (!email || !fullName) {
        skipped++;
        continue;
      }
      try {
        // Apparel + extras from merchandise/extra lines.
        let jacket: string | null = null;
        let tshirt: string | null = null;
        const extras: { name: string; qty: number; size?: string }[] = [];
        const lines = [...toLineArray(entry.merchandise), ...toLineArray(entry.extra)];
        for (const line of lines) {
          const itemName = (line?.item?.name ?? "").trim();
          if (!itemName) continue;
          const option = line?.option?.name ?? null;
          const size = normaliseSize(option);
          const lower = itemName.toLowerCase();
          if (size && lower.includes("jacket")) jacket = size;
          else if (size && (lower.includes("shirt") || lower.includes("tee"))) tshirt = size;
          else
            extras.push({
              name: option ? `${itemName}: ${option}` : itemName,
              qty: 1,
            });
        }

        const { data: existing, error: findErr } = await supabase
          .from("entrants")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        if (findErr) throw findErr;

        const idNumber = (p?.id_number ?? "").trim();
        const entrantPayload = {
          full_name: fullName,
          phone: p?.cell_phone_number || null,
          ...(idNumber.length >= 4
            ? { id_number_hash: hashIdNumber(idNumber), id_number_last4: idNumberLast4(idNumber) }
            : {}),
        };

        let entrantId: string;
        if (existing?.id) {
          entrantId = existing.id;
          await supabase.from("entrants").update(entrantPayload).eq("id", entrantId);
          updated++;
        } else {
          const { data: ins, error: insErr } = await supabase
            .from("entrants")
            .insert({ email, ...entrantPayload })
            .select("id")
            .single();
          if (insErr || !ins) throw insErr ?? new Error("insert failed");
          entrantId = ins.id;
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
            jacket_size: jacket,
            tshirt_size: tshirt,
            extras,
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
  });
