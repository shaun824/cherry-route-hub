// Rider-facing: pull a signed-in rider's past Entry Ninja entries and store
// them as their event history.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  id_number: z.string().trim().max(50).optional().default(""),
  surname: z.string().trim().max(80).optional().default(""),
});

export const syncMyEntryNinjaHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { syncRiderHistory } = await import("./entryninja-history.server");
    return syncRiderHistory({
      supabase: context.supabase,
      userId: context.userId,
      email: ((context.claims as Record<string, unknown>)["email"] as string | undefined) ?? null,
      idNumber: data.id_number,
      surname: data.surname,
    });
  });
