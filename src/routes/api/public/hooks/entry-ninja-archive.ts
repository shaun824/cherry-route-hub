// One-shot / scheduled archive backfill: pulls entrants from EVERY Entry Ninja
// event on the account (including long-closed ones) into our roster.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/entry-ninja-archive")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace("Bearer ", "") ??
          "";
        const expected =
          import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
          process.env["SUPABASE_PUBLISHABLE_KEY"] ??
          "";

        if (!apikey || (expected && apikey !== expected)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const url = new URL(request.url);
        const start = Number(url.searchParams.get("start") ?? "0") || 0;
        const count = Math.min(Math.max(Number(url.searchParams.get("count") ?? "3") || 3, 1), 10);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { backfillArchiveChunk, linkEntrantsToAccounts } = await import(
          "@/lib/entryninja-archive.server"
        );

        try {
          const res = await backfillArchiveChunk(supabaseAdmin, { start, count });
          const linked = res.nextStart == null ? await linkEntrantsToAccounts(supabaseAdmin) : null;
          return new Response(JSON.stringify({ success: true, ...res, linked }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          console.error("[entry-ninja-archive] failed", err);
          return new Response(JSON.stringify({ success: false, error: (err as Error).message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
