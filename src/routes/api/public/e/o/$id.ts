// Open-tracking pixel for app emails.
import { createFileRoute } from "@tanstack/react-router";

const PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

export const Route = createFileRoute("/api/public/e/o/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.id.replace(/\.(gif|png)$/i, "");
        if (/^[0-9a-f-]{36}$/i.test(id)) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const admin = supabaseAdmin as any;
            const { data } = await admin
              .from("email_sends")
              .select("open_count, opened_at")
              .eq("id", id)
              .maybeSingle();
            if (data) {
              const now = new Date().toISOString();
              await admin
                .from("email_sends")
                .update({
                  opened_at: data.opened_at ?? now,
                  last_opened_at: now,
                  open_count: (data.open_count ?? 0) + 1,
                })
                .eq("id", id);
            }
          } catch (err) {
            console.error("[email-open] failed", err);
          }
        }
        return new Response(PIXEL, {
          headers: {
            "Content-Type": "image/gif",
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
          },
        });
      },
    },
  },
});
