import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "@/lib/is-admin";

const venueSchema = z.object({ venueId: z.string().uuid() });

/** Reads a venue's linked Google Sheet without writing anything. */
export const previewRoomingSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => venueSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase as never))) throw new Error("Forbidden");
    const { readSheetRooming } = await import("@/lib/rooming-sheet.server");
    const { data: venue } = await context.supabase
      .from("event_venues")
      .select("rooming_sheet_url, rooming_sheet_range")
      .eq("id", data.venueId)
      .maybeSingle();
    if (!venue?.rooming_sheet_url) throw new Error("This venue has no Google Sheet linked.");
    const { rows } = await readSheetRooming(venue.rooming_sheet_url, venue.rooming_sheet_range);
    return { rows: rows.slice(0, 500), total: rows.length };
  });

/** Pulls the linked Google Sheet and rewrites this venue's rooming list. */
export const syncRoomingSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => venueSchema.parse(data))
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase as never))) throw new Error("Forbidden");
    const { syncVenueSheet } = await import("@/lib/rooming-sync.server");
    return syncVenueSheet(context.supabase as never, data.venueId);
  });
