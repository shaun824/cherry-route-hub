// Click tracking for app emails: records the link, then redirects.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/e/c/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const url = new URL(request.url);
        const target = url.searchParams.get("u") ?? "";
        const safe = /^https?:\/\//i.test(target) ? target : "https://riderapp.redcherryevents.co.za";

        if (/^[0-9a-f-]{36}$/i.test(params.id)) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const admin = supabaseAdmin as any;
            await admin.from("email_send_clicks").insert({ send_id: params.id, url: safe });
            const { data } = await admin
              .from("email_sends")
              .select("click_count")
              .eq("id", params.id)
              .maybeSingle();
            if (data) {
              await admin
                .from("email_sends")
                .update({ click_count: (data.click_count ?? 0) + 1 })
                .eq("id", params.id);
            }
          } catch (err) {
            console.error("[email-click] failed", err);
          }
        }

        return new Response(null, {
          status: 302,
          headers: { Location: safe, "Cache-Control": "no-store" },
        });
      },
    },
  },
});
