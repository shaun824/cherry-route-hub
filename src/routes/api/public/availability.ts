import { createFileRoute } from "@tanstack/react-router";
import { buildAvailability } from "@/lib/public-availability";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
};
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;
const notFound = () =>
  Response.json({ error: "not found" }, { status: 404, headers: { ...cors, "cache-control": "no-store" } });

// Public, count-only "spots left" feed for marketing websites.
export const Route = createFileRoute("/api/public/availability")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const slug = new URL(request.url).searchParams.get("slug")?.trim().toLowerCase() ?? "";
        if (!SLUG_RE.test(slug)) return notFound();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: ev } = await supabaseAdmin
          .from("events")
          .select("id, slug, classes, capacity, is_public, is_review_event")
          .eq("slug", slug)
          .maybeSingle();
        if (!ev || ev.is_public !== true || ev.is_review_event === true) return notFound();
        const { data: rows, error } = await supabaseAdmin
          .from("event_entrants")
          .select("category")
          .eq("event_id", ev.id)
          .limit(10000);
        if (error) {
          return Response.json({ error: "temporarily unavailable" }, { status: 503, headers: { ...cors, "cache-control": "no-store" } });
        }
        const body = buildAvailability(
          ev.slug!,
          ev.capacity,
          Array.isArray(ev.classes) ? (ev.classes as any[]) : [],
          (rows ?? []).map((r) => r.category),
        );
        return Response.json(body, { headers: { ...cors, "cache-control": "public, max-age=3600" } });
      },
    },
  },
});
