// One-click unsubscribe for event interest emails. The link in every interest
// email points here with the sign-up id; we mark it unsubscribed and show a
// plain confirmation page. No login needed — the id is an unguessable uuid.
import { createFileRoute } from "@tanstack/react-router";

const page = (title: string, message: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#fff;color:#1B1B1F;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0"><main style="max-width:420px;padding:32px;text-align:center"><h1 style="font-size:22px;margin:0 0 12px">${title}</h1><p style="font-size:15px;line-height:1.6;color:#5C5F66;margin:0">${message}</p></main></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

export const Route = createFileRoute("/api/public/event-interest-unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("id") ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(id)) {
          return page("Link not recognised", "This unsubscribe link is not valid. If you keep receiving emails you do not want, contact team@redcherryevents.co.za.");
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("event_interest_signups")
          .update({ unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", id)
          .is("unsubscribed_at", null)
          .select("id")
          .maybeSingle();
        if (!data) {
          return page("Already unsubscribed", "You are already off this list, or the link has expired. You will not receive further emails about this event.");
        }
        return page("You are unsubscribed", "Done, you will not receive further emails about this event. If this was a mistake, just fill in the sign-up form on the event website again.");
      },
    },
  },
});
