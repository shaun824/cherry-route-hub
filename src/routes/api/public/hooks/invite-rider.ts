// One-off admin utility: invite a roster entrant to create their Rider Hub
// account. Protected by a shared secret header so only trusted callers can use it.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().trim().email(),
  redirectTo: z.string().url().optional(),
});

export const Route = createFileRoute("/api/public/hooks/invite-rider")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["INVITE_HOOK_SECRET"];
        if (!secret || request.headers.get("x-invite-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: entrant } = await supabaseAdmin
          .from("entrants")
          .select("full_name")
          .ilike("email", parsed.email)
          .maybeSingle();

        const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(parsed.email, {
          redirectTo: parsed.redirectTo ?? "https://riderapp.redcherryevents.co.za/reset-password",
          data: entrant?.full_name ? { full_name: entrant.full_name } : undefined,
        });

        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 400 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
