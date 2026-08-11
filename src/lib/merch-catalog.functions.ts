// Admin-only server functions for the per-event merchandise catalogue.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const syncSchema = z.object({ eventId: z.string().uuid().optional() });

export type MerchOption = { id?: number | null; name: string; price?: number | null };

export type MerchCatalogEvent = {
  eventId: string;
  eventName: string;
  eventDate: string | null;
  entryNinjaId: string | null;
  syncedAt: string | null;
  items: { id: string; name: string; enItemId: number | null; options: MerchOption[] }[];
  questions: { name: string; question: string }[];
};

export const syncMerchCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => syncSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Forbidden");

    const { fetchEnEventDetail } = await import("./entryninja.server");

    let q = context.supabase
      .from("events")
      .select("id, name, entry_ninja_id")
      .not("entry_ninja_id", "is", null);
    if (data.eventId) q = q.eq("id", data.eventId);
    const { data: events, error } = await q;
    if (error) throw error;

    const errors: string[] = [];
    let itemCount = 0;

    for (const ev of events ?? []) {
      const enId = Number(ev.entry_ninja_id);
      if (!Number.isFinite(enId)) continue;
      try {
        const detail = await fetchEnEventDetail(enId);
        const items = detail.available_merchandise ?? [];
        const rows = items.map((item, index) => ({
          event_id: ev.id,
          en_item_id: item.id ?? null,
          name: String(item.name ?? "Merchandise"),
          options: (item.options ?? []).map((o) => ({
            id: o.id ?? null,
            name: String(o.name ?? ""),
            price: o.price != null ? Number(String(o.price).replace(/[^0-9.]/g, "")) || null : null,
          })),
          position: index,
          synced_at: new Date().toISOString(),
        }));

        // Replace the stored catalogue for this event with the live one.
        await context.supabase.from("event_merch_options").delete().eq("event_id", ev.id);
        if (rows.length) {
          const { error: insErr } = await context.supabase.from("event_merch_options").insert(rows);
          if (insErr) throw insErr;
        }
        itemCount += rows.length;

        const questions = (detail.extra ?? [])
          .filter((x) => x?.question)
          .map((x) => ({ name: String(x.name ?? ""), question: String(x.question ?? "") }));
        await context.supabase
          .from("events")
          .update({ merch_questions: questions } as never)
          .eq("id", ev.id);
      } catch (err) {
        errors.push(`${ev.name}: ${(err as Error).message}`);
      }
    }

    return { events: (events ?? []).length, items: itemCount, errors };
  });

export const listMerchCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MerchCatalogEvent[]> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Forbidden");

    const [{ data: events }, { data: options }] = await Promise.all([
      context.supabase.from("events").select("id, name, date, entry_ninja_id").order("date"),
      context.supabase
        .from("event_merch_options")
        .select("id, event_id, name, en_item_id, options, position, synced_at")
        .order("position"),
    ]);

    const byEvent = new Map<string, MerchCatalogEvent>();
    for (const ev of events ?? []) {
      byEvent.set(ev.id, {
        eventId: ev.id,
        eventName: ev.name,
        eventDate: (ev as { date?: string | null }).date ?? null,
        entryNinjaId: (ev as { entry_ninja_id?: string | null }).entry_ninja_id ?? null,
        syncedAt: null,
        items: [],
        questions: ((ev as { merch_questions?: unknown }).merch_questions as
          | { name: string; question: string }[]
          | undefined) ?? [],
      });
    }

    for (const row of options ?? []) {
      const bucket = byEvent.get(row.event_id);
      if (!bucket) continue;
      bucket.items.push({
        id: row.id,
        name: row.name,
        enItemId: row.en_item_id ? Number(row.en_item_id) : null,
        options: (row.options as MerchOption[] | null) ?? [],
      });
      const syncedAt = (row as { synced_at?: string | null }).synced_at ?? null;
      if (syncedAt && (!bucket.syncedAt || syncedAt > bucket.syncedAt)) bucket.syncedAt = syncedAt;
    }

    return [...byEvent.values()];
  });
