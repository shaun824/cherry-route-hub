// Rider-facing: refresh just this rider's Entry Ninja entries on demand.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const syncMyEntriesNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncMyEntries } = await import("./my-entries-sync.server");
    return syncMyEntries({
      admin: supabaseAdmin,
      userId: context.userId,
      email: ((context.claims as Record<string, unknown>)["email"] as string | undefined) ?? null,
    });
  });
