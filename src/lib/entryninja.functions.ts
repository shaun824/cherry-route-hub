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

    const { syncEnEvent } = await import("./entryninja-sync.server");
    return syncEnEvent(context.supabase, {
      enEventId: data.enEventId,
      ...(data.eventId ? { eventId: data.eventId } : {}),
    });
  });

