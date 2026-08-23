// Admin-only server functions for the per-event price book that powers the
// "amount owing" figure riders see (Entry Ninja's API has no money values).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "./is-admin";

const eventSchema = z.object({ eventId: z.string().uuid() });

const saveSchema = z.object({
  eventId: z.string().uuid(),
  prices: z
    .array(
      z.object({
        kind: z.enum(["category", "extra"]),
        label: z.string().min(1),
        priceCents: z.number().int().min(0).nullable(),
      }),
    )
    .max(500),
});

export type PriceBookLabel = {
  kind: "category" | "extra";
  label: string;
  /** How many entries on this event use the label — helps admins price the big ones first. */
  count: number;
  priceCents: number | null;
};

export type PriceBookEvent = {
  eventId: string;
  eventName: string;
  eventDate: string | null;
  unpaidCount: number;
  labels: PriceBookLabel[];
};

export const listPriceBookEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("events")
      .select("id, name, event_date, lifecycle")
      .neq("lifecycle", "archived")
      .order("event_date", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      eventDate: e.event_date,
    }));
  });

export const getPriceBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => eventSchema.parse(d))
  .handler(async ({ data, context }): Promise<PriceBookEvent> => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { collectPriceLabels } = await import("./price-book.server");

    const [{ data: ev }, { data: entrants }, { data: prices }] = await Promise.all([
      supabaseAdmin.from("events").select("id, name, event_date").eq("id", data.eventId).maybeSingle(),
      supabaseAdmin.from("event_entrants").select("category, extras, paid").eq("event_id", data.eventId),
      supabaseAdmin
        .from("event_price_book")
        .select("kind, label, price_cents")
        .eq("event_id", data.eventId),
    ]);
    if (!ev) throw new Error("Event not found");

    const rows = (entrants ?? []) as { category: string | null; extras: unknown; paid: boolean | null }[];
    return {
      eventId: ev.id,
      eventName: ev.name,
      eventDate: ev.event_date,
      unpaidCount: rows.filter((r) => r.paid === false).length,
      labels: collectPriceLabels(
        rows,
        (prices ?? []) as { kind: string; label: string; price_cents: number }[],
      ),
    };
  });

export const savePriceBook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const keep = data.prices.filter((p) => p.priceCents != null);
    const drop = data.prices.filter((p) => p.priceCents == null);

    for (const p of drop) {
      await supabaseAdmin
        .from("event_price_book")
        .delete()
        .eq("event_id", data.eventId)
        .eq("kind", p.kind)
        .eq("label", p.label);
    }

    if (keep.length) {
      const { error } = await supabaseAdmin.from("event_price_book").upsert(
        keep.map((p) => ({
          event_id: data.eventId,
          kind: p.kind,
          label: p.label,
          price_cents: p.priceCents as number,
        })),
        { onConflict: "event_id,kind,label" },
      );
      if (error) throw error;
    }

    // Push the new prices straight onto every entry so riders see amounts.
    const { applyPriceBookToEntrants } = await import("./price-book.server");
    const applied = await applyPriceBookToEntrants(supabaseAdmin as never, data.eventId);

    return { saved: keep.length, removed: drop.length, ...applied };
  });
