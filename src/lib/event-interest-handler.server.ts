// Shared event-interest action. The public website form and secret-gated WordPress endpoint use the same stored consent and audience.
import { z } from "zod";

import { normaliseEmail } from "@/lib/event-interest";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Content-Type": "application/json" } });

const schema = z.object({
  event_id: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  topic: z.string().trim().max(200).optional(),
  source: z.string().trim().max(200).optional(),
  consent: z.literal(true, { error: "Consent is required" }),
  website: z.string().max(200).optional(), // honeypot
});

export async function handleEventInterest(request: Request): Promise<Response> {
        // Shared secret, server to server — no CORS, no browser callers.
        const expected = process.env["EVENT_INTEREST_KEY"];
        if (!expected) return json({ ok: false, error: "Event interest sign-ups are not configured" }, 503);
        const key = request.headers.get("x-event-interest-key") ?? "";
        if (!key || key !== expected) return json({ ok: false, error: "Unauthorized" }, 401);

        let parsed;
        try {
          const raw = request.headers.get("content-type")?.includes("json")
            ? await request.json()
            : Object.fromEntries(await request.formData());
          if (raw && typeof raw === "object" && "consent" in raw) {
            // HTML forms send "on"/"true" strings — normalise to boolean.
            const v = (raw as Record<string, unknown>).consent;
            (raw as Record<string, unknown>).consent = v === true || v === "true" || v === "on" || v === "1";
          }
          parsed = schema.safeParse(raw);
        } catch {
          return json({ ok: false, error: "Invalid request" }, 400);
        }
        if (!parsed.success) {
          const first = parsed.error.issues[0];
          return json({ ok: false, error: first ? `${first.path.join(".")}: ${first.message}` : "Invalid request" }, 400);
        }
        if (parsed.data.website) return json({ ok: true }); // honeypot: pretend it worked

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Light rate limit: cap total sign-ups per minute across all events.
        const since = new Date(Date.now() - 60_000).toISOString();
        const { count } = await supabaseAdmin
          .from("event_interest_signups")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since);
        if ((count ?? 0) > 60) {
          return json({ ok: false, error: "Too many sign-ups right now, please try again in a minute" }, 429);
        }

        // The event must exist and be published.
        const { data: event } = await supabaseAdmin
          .from("events")
          .select("id, lifecycle, everlytic_interest_list_id, is_review_event")
          .eq("id", parsed.data.event_id)
          .maybeSingle();
        if (!event || event.lifecycle !== 'published' || event.is_review_event) {
          return json({ ok: false, error: "Unknown event" }, 404);
        }

        const email = normaliseEmail(parsed.data.email);
        const now = new Date().toISOString();
        const { data: existing } = await supabaseAdmin
          .from("event_interest_signups")
          .select("id")
          .eq("event_id", event.id)
          .eq("email", email)
          .maybeSingle();

        let signupId: string;
        if (existing) {
          // Repeat sign-up: refresh the details, keep the original row.
          const { error } = await supabaseAdmin
            .from("event_interest_signups")
            .update({
              name: parsed.data.name ?? null,
              ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
              topic: parsed.data.topic ?? null,
              source: parsed.data.source ?? null,
              consent: true,
              consent_at: now,
              updated_at: now,
            })
            .eq("id", existing.id);
          if (error) return json({ ok: false, error: "Could not save the sign-up, please try again" }, 500);
          signupId = existing.id;
        } else {
          const { data, error } = await supabaseAdmin
            .from("event_interest_signups")
            .insert({
              event_id: event.id,
              email,
              name: parsed.data.name ?? null,
              phone: parsed.data.phone ?? null,
              topic: parsed.data.topic ?? null,
              source: parsed.data.source ?? null,
              consent: true,
              consent_at: now,
            })
            .select("id")
            .single();
          if (error) return json({ ok: false, error: "Could not save the sign-up, please try again" }, 500);
          signupId = data.id;
        }

        // Optional Everlytic sync — never blocks the response. The event
        // setting holds one list ID or a comma-separated set (e.g. a dedicated
        // event list plus the master Motorbikes list).
        const listIds = String((event as { everlytic_interest_list_id?: string | null }).everlytic_interest_list_id ?? "")
          .split(/[\s,;]+/)
          .map((id) => id.trim())
          .filter((id) => /^\d+$/.test(id));
        const username = process.env["EVERLYTIC_USERNAME"];
        const apiKey = process.env["EVERLYTIC_API_KEY"];
        if (listIds.length && username && apiKey) {
          try {
            const { syncEventInterestToList } = await import("@/lib/event-interest.server");
            for (const listId of listIds) {
              await syncEventInterestToList(email, listId, username, apiKey, parsed.data.name ?? null);
            }
            await supabaseAdmin.from("event_interest_signups").update({ everlytic_synced: true }).eq("id", signupId);
          } catch (e) {
            console.error("Event interest list sync deferred", (e as Error).message);
          }
        }

        // Sign-up confirmation email — fire and forget, idempotent per sign-up
        // row so repeat sign-ups do not resend it.
        try {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          const firstName = (parsed.data.name ?? "").trim().split(/\s+/)[0] || null;
          await sendTemplateEmail("ice-signup-confirmation", email, {
            idempotencyKey: `event-interest-confirm-${signupId}`,
            templateData: { firstName },
          });
        } catch (e) {
          console.error("Event interest confirmation deferred", (e as Error).message);
        }

        return json({ ok: true, id: signupId });
}
