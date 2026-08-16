// Admin-only server functions for the per-event merchandise catalogue.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "./is-admin";

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
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");

    const { fetchEnEventDetail } = await import("./entryninja.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
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

        // Replace the synced catalogue for this event with the live one, but
        // keep any manually added items (they have no Entry Ninja item id).
        await supabaseAdmin
          .from("event_merch_options")
          .delete()
          .eq("event_id", ev.id)
          .not("en_item_id", "is", null);
        if (rows.length) {
          const { error: insErr } = await supabaseAdmin.from("event_merch_options").insert(rows);
          if (insErr) throw insErr;
        }
        itemCount += rows.length;


      } catch (err) {
        errors.push(`${ev.name}: ${(err as Error).message}`);
      }
    }

    return { events: (events ?? []).length, items: itemCount, errors };
  });

export const listMerchCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MerchCatalogEvent[]> => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");

    const [{ data: events }, { data: options }] = await Promise.all([
      context.supabase.from("events").select("id, name, event_date, entry_ninja_id").order("event_date"),
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
        eventDate: (ev as { event_date?: string | null }).event_date ?? null,
        entryNinjaId: (ev as { entry_ninja_id?: string | null }).entry_ninja_id ?? null,
        syncedAt: null,
        items: [],
        questions: [],
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

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  eventId: z.string().uuid(),
  name: z.string().min(1).max(200),
  options: z.array(z.string().max(200)).max(60),
});

export const upsertMerchItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => upsertSchema.parse(data))
  .handler(async ({ data, context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const options = data.options
      .map((o) => o.trim())
      .filter(Boolean)
      .map((name) => ({ id: null, name, price: null }));

    if (data.id) {
      const { error } = await supabaseAdmin
        .from("event_merch_options")
        .update({ name: data.name, options })
        .eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }

    const { data: row, error } = await supabaseAdmin
      .from("event_merch_options")
      .insert({ event_id: data.eventId, name: data.name, options, position: 999 })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const deleteMerchItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("event_merch_options").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/** Re-read event websites and enrich the catalogue with descriptions/prices. */
export const syncMerchWebInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => syncSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncAllEventMerchInfo } = await import("./merch-scrape.server");
    return await syncAllEventMerchInfo(supabaseAdmin, data.eventId);
  });
