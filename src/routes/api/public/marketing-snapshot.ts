// Read-only marketing summary for an external AI content agent.
// Protected by the MARKETING_API_KEY secret (x-api-key header). No personal data returned.
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

const DAY = 86_400_000;

function safeEq(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

function familyOf(name: string) {
  return name
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function packageOf(category: string | null, extras: unknown): "day_pass" | "hotel_luxury" | "rider" {
  if (/day\s*pass/i.test(category ?? "")) return "day_pass";
  const names = Array.isArray(extras) ? extras.map((x: any) => String(x?.name ?? "")).join(" ") : "";
  if (/hotel|luxury|lodge|guest\s*house|b&b/i.test(`${category ?? ""} ${names}`)) return "hotel_luxury";
  return "rider";
}

function tally<T extends string>(values: (T | null | undefined)[]) {
  const out: Record<string, number> = {};
  for (const v of values) out[v ?? "unknown"] = (out[v ?? "unknown"] ?? 0) + 1;
  return out;
}

export const Route = createFileRoute("/api/public/marketing-snapshot")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const started = Date.now();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const log = (authorized: boolean, status: number, events_returned: number | null) =>
          supabaseAdmin.from("marketing_api_calls").insert({
            authorized,
            status,
            events_returned,
            ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for"),
            user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
            duration_ms: Date.now() - started,
          });

        const expected = process.env["MARKETING_API_KEY"] ?? "";
        const given =
          request.headers.get("x-api-key") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!expected || !given || !safeEq(given, expected)) {
          await log(false, 401, null);
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        try {
          const now = Date.now();
          const { data: events, error } = await supabaseAdmin
            .from("events")
            .select(
              "id, name, slug, discipline, event_date, location, distance_km, status, entry_ninja_url, website_url, photos_album_url, results_url, title_sponsor_name",
            )
            .eq("is_public", true)
            .neq("lifecycle", "draft")
            .gte("event_date", new Date(now - 365 * DAY).toISOString())
            .lte("event_date", new Date(now + 365 * DAY).toISOString())
            .order("event_date");
          if (error) throw error;

          // All entries (paginated) — needed for returning-rider counts across events.
          const all: any[] = [];
          for (let from = 0; ; from += 1000) {
            const { data, error: e } = await supabaseAdmin
              .from("event_entrants")
              .select("event_id, entrant_id, category, created_at, gender, extras, entrants(age_band)")
              .range(from, from + 999);
            if (e) throw e;
            all.push(...(data ?? []));
            if (!data || data.length < 1000) break;
          }
          const { data: allEvents } = await supabaseAdmin.from("events").select("id, event_date");
          const dateOf = new Map((allEvents ?? []).map((e: any) => [e.id, new Date(e.event_date).getTime()]));
          const historyByEntrant = new Map<string, number[]>();
          for (const r of all) {
            const d = dateOf.get(r.event_id);
            if (d == null) continue;
            const arr = historyByEntrant.get(r.entrant_id) ?? [];
            arr.push(d);
            historyByEntrant.set(r.entrant_id, arr);
          }

          const ids = (events ?? []).map((e) => e.id);
          const { data: posts } = ids.length
            ? await supabaseAdmin
                .from("event_social_posts")
                .select("event_id, platform, post_url, caption, thumbnail_url, posted_at")
                .in("event_id", ids)
                .eq("active", true)
                .order("posted_at", { ascending: false, nullsFirst: false })
            : { data: [] as any[] };

          const out = (events ?? []).map((ev) => {
            const evDate = new Date(ev.event_date).getTime();
            const rows = all.filter((r) => r.event_id === ev.id);
            const cats = tally(rows.map((r) => r.category));
            return {
              name: ev.name,
              slug: ev.slug,
              family: familyOf(ev.name),
              discipline: ev.discipline,
              date: ev.event_date,
              days_to_go: Math.ceil((evDate - now) / DAY),
              location: ev.location,
              distance_km: ev.distance_km,
              status: ev.status,
              entry_ninja_url: ev.entry_ninja_url,
              website_url: ev.website_url,
              photos_album_url: ev.photos_album_url,
              results_url: ev.results_url,
              title_sponsor: ev.title_sponsor_name,
              total_entries: rows.length,
              entries_last_7_days: rows.filter((r) => now - new Date(r.created_at).getTime() <= 7 * DAY).length,
              entries_last_14_days: rows.filter((r) => now - new Date(r.created_at).getTime() <= 14 * DAY).length,
              returning_riders: rows.filter((r) => (historyByEntrant.get(r.entrant_id) ?? []).some((d) => d < evDate - DAY)).length,
              top_categories: Object.entries(cats)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([category, count]) => ({ category, count })),
              u14_count: rows.filter((r) => /u\s*\/?\s*14|under\s*14/i.test(r.category ?? "") || r.entrants?.age_band === "U14").length,
              gender_split: tally(rows.map((r) => r.gender)),
              age_band_split: tally(rows.map((r) => r.entrants?.age_band)),
              package_mix: tally(rows.map((r) => packageOf(r.category, r.extras))),
              recent_social_posts: (posts ?? [])
                .filter((p: any) => p.event_id === ev.id)
                .slice(0, 5)
                .map(({ event_id: _e, ...p }: any) => p),
            };
          });

          await log(true, 200, out.length);
          return Response.json({ generated_at: new Date().toISOString(), events: out });
        } catch (err) {
          console.error("[marketing-snapshot]", err);
          await log(true, 500, null);
          return Response.json({ error: "Snapshot failed" }, { status: 500 });
        }
      },
    },
  },
});
