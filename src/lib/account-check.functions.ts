import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ email: z.string().email().max(200) });

/**
 * Tells the sign-in page whether a failed login was because the person has no
 * Rider Hub account yet (they only ever used Entry Ninja), and whether we can
 * see entries under that email so we can promise their events will link up.
 */
export const checkAccountExists = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (profile) return { hasAccount: true, hasEntries: false };

    const { data: entrant } = await supabaseAdmin
      .from("entrants")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    return { hasAccount: false, hasEntries: Boolean(entrant) };
  });
