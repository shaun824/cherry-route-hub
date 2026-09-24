// Admin-only: generate a password-recovery link for a user, e.g. when their
// reset email won't arrive and support wants to send them a link directly.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "./is-admin";

const schema = z.object({ email: z.string().trim().email() });

export const generateResetLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase))) throw new Error("Admins only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email.toLowerCase(),
      options: { redirectTo: "https://riderapp.redcherryevents.co.za/reset-password" },
    });
    if (error) throw new Error(error.message);
    const actionLink = link?.properties?.action_link;
    if (!actionLink) throw new Error("No recovery link returned");
    return { ok: true as const, email: data.email.toLowerCase(), action_link: actionLink };
  });
