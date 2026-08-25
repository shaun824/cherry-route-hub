// Admin-only: provision a crew portal account for someone with an email address
// and send them the training invite email.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "./is-admin";

const inviteSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().max(120).optional().default(""),
  password: z.string().min(8).max(72).optional(),
});

const SITE_URL = "https://riderapp.redcherryevents.co.za";

function tempPassword() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `Cherry-${n}${Math.random().toString(36).slice(2, 6)}`;
}

export const inviteCrewMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase))) throw new Error("Admins only");
    const email = data.email.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    let user = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email) ?? null;

    const password = data.password ?? tempPassword();
    let issuedPassword: string | null = password;

    if (user) {
      // Existing account — don't reset their password silently.
      issuedPassword = null;
      if (data.full_name) {
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          user_metadata: { ...(user.user_metadata ?? {}), full_name: data.full_name },
        });
      }
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name || email.split("@")[0], must_set_password: true },
      });
      if (error) throw new Error(error.message);
      user = created.user!;
    }

    await supabaseAdmin.from("user_roles").upsert(
      { user_id: user.id, role: "crew" },
      { onConflict: "user_id,role", ignoreDuplicates: true },
    );

    const { sendTemplateEmail } = await import("./email-templates/send-email");
    const result = await sendTemplateEmail("crew-training-invite", email, {
      templateData: {
        firstName: (data.full_name || "").split(" ")[0] || undefined,
        email,
        tempPassword: issuedPassword,
        loginUrl: `${SITE_URL}/auth`,
        learnUrl: `${SITE_URL}/crew/learn`,
      },
      idempotencyKey: `crew-training-invite-${user.id}-${new Date().toISOString().slice(0, 10)}`,
    });

    return {
      ok: true as const,
      user_id: user.id,
      email,
      emailed: result.sent,
      temp_password: issuedPassword,
    };
  });
