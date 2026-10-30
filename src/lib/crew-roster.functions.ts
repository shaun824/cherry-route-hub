import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Minimal operational roster, never exposes medical notes or ID hashes. */
export const getCrewRosterSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).in("role", ["admin", "crew"]);
    if (!roles?.length) throw new Error("Forbidden");
    const { data: event } = await context.supabase.from("events").select("id").eq("id", data.eventId).maybeSingle();
    if (!event) throw new Error("Event not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("event_entrants").select("id, bib_number, registration_ref, category, batch").eq("event_id", data.eventId);
    if (error) throw new Error("Could not load roster");
    return { rows: rows ?? [], count: rows?.length ?? 0 };
  });