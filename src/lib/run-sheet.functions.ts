import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "@/lib/is-admin";

const eventSchema = z.object({ eventId: z.string().uuid() });

/** Reads the linked run sheet without writing anything (admin preview). */
export const previewRunSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => eventSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase as never))) throw new Error("Forbidden");
    const { readRunSheet } = await import("@/lib/run-sheet.server");
    const { data: event } = await context.supabase
      .from("events")
      .select("run_sheet_url")
      .eq("id", data.eventId)
      .maybeSingle();
    if (!event?.run_sheet_url) throw new Error("This event has no run sheet linked.");
    const parsed = await readRunSheet(event.run_sheet_url);
    return {
      departments: parsed.departments,
      skipped: parsed.skipped,
      taskCount: parsed.tasks.length,
      packingCount: parsed.packing.length,
      briefCount: parsed.briefs.length,
      sample: parsed.tasks.slice(0, 40),
    };
  });

/** Pulls the linked run sheet and rewrites this event's departments and tasks. */
export const syncRunSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => eventSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase as never))) throw new Error("Forbidden");
    const { syncEventRunSheet } = await import("@/lib/run-sheet.server");
    return syncEventRunSheet(context.supabase as never, data.eventId);
  });
