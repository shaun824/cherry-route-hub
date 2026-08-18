// Admin-only server functions for the full Entry Ninja history backfill.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "./is-admin";

const chunkSchema = z.object({
  start: z.number().int().min(0).optional(),
  count: z.number().int().min(1).max(10).optional(),
});

/** Pulls one slice of the Entry Ninja archive into the roster. */
export const backfillEntryNinjaArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => chunkSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");

    const { backfillArchiveChunk } = await import("./entryninja-archive.server");
    return backfillArchiveChunk(context.supabase, {
      start: data.start ?? 0,
      count: data.count ?? 3,
    });
  });

/** Matches roster records to app accounts by email. */
export const linkRosterToAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { linkEntrantsToAccounts } = await import("./entryninja-archive.server");
    return linkEntrantsToAccounts(supabaseAdmin);
  });

/** Roster coverage numbers for the admin screen. */
export const rosterCoverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = await checkIsAdmin(context.supabase as never);
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const count = async (build: (q: any) => any) => {
      const { count: c } = await build(
        supabaseAdmin.from("entrants").select("id", { count: "exact", head: true }),
      );
      return c ?? 0;
    };

    const [total, withId, withAccount, entries] = await Promise.all([
      count((q: any) => q),
      count((q: any) => q.not("id_number_hash", "is", null)),
      count((q: any) => q.not("user_id", "is", null)),
      supabaseAdmin.from("event_entrants").select("id", { count: "exact", head: true }),
    ]);

    return { entrants: total, withIdNumber: withId, linkedToAccounts: withAccount, entries: entries.count ?? 0 };
  });
