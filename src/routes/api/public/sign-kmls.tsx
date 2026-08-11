import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/sign-kmls")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: list, error } = await supabaseAdmin.storage.from("event-kmls").list("", {
          limit: 100,
        });
        if (error) return new Response(error.message, { status: 500 });
        const out: Record<string, string> = {};
        for (const f of list ?? []) {
          const { data: signed } = await supabaseAdmin.storage
            .from("event-kmls")
            .createSignedUrl(f.name, 60 * 60 * 24 * 365 * 10);
          if (signed?.signedUrl) out[f.name] = signed.signedUrl;
        }
        return Response.json(out);
      },
    },
  },
});
