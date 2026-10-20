// Public sign-up for "entries open 1 December" alerts, posted from the Otto1890 Weekend Warrior website.
// Stores the email, subscribes it to the Everlytic sign-up list, and sends the dates confirmation.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254), website: z.string().max(0).optional() });

export const Route = createFileRoute("/api/public/entry-interest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        let parsed;
        try {
          const raw = request.headers.get("content-type")?.includes("json")
            ? await request.json()
            : Object.fromEntries(await request.formData());
          parsed = schema.safeParse(raw);
        } catch { return json({ ok: false, error: "Invalid request" }, 400); }
        if (!parsed.success) return json({ ok: false, error: "Please enter a valid email address" }, 400);
        if (parsed.data.website) return json({ ok: true }); // honeypot
        const email = parsed.data.email;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Light rate limit: cap total sign-ups per minute.
        const since = new Date(Date.now() - 60_000).toISOString();
        const { count } = await supabaseAdmin.from("entry_interest_signups").select("id", { count: "exact", head: true }).gte("created_at", since);
        if ((count ?? 0) > 60) return json({ ok: false, error: "Too many sign-ups right now, please try again in a minute" }, 429);

        const { data: existing } = await supabaseAdmin.from("entry_interest_signups").select("id, everlytic_synced, confirmation_sent").eq("email", email).maybeSingle();
        let row = existing;
        if (!row) {
          const { data, error } = await supabaseAdmin.from("entry_interest_signups").insert({ email }).select("id, everlytic_synced, confirmation_sent").single();
          if (error) return json({ ok: false, error: "Could not save your sign-up, please try again" }, 500);
          row = data;
        }

        {
          const username = process.env["EVERLYTIC_USERNAME"]; const apiKey = process.env["EVERLYTIC_API_KEY"];
          if (username && apiKey) {
            try {
              const { syncEntryInterestAudience } = await import("@/lib/entry-interest-audience.server");
              await syncEntryInterestAudience(email, username, apiKey);
              await supabaseAdmin.from("entry_interest_signups").update({ everlytic_synced: true }).eq("id", row.id);
            } catch (e) {
              // Never block the visitor: the row stays everlytic_synced=false for the admin reconcile.
              console.error("Entry-alert list sync deferred", (e as Error).message);
            }
          }
        }

        if (!row.confirmation_sent) {
          try {
            const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
            await sendTemplateEmail("entry-interest-confirmation", email, { idempotencyKey: `entry-interest-${row.id}` });
            await supabaseAdmin.from("entry_interest_signups").update({ confirmation_sent: true }).eq("id", row.id);
          } catch (e) { console.error("Sign-up confirmation failed", (e as Error).message); }
        }
        return json({ ok: true });
      },
    },
  },
});
