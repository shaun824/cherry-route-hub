// Recurring pull of new articles from the Red Cherry Events websites into the app news feed.
// Server-only: never import from client code.
import type { SupabaseClient } from "@supabase/supabase-js";

type NewsSource = {
  /** Label shown as the post author. */
  author: string;
  /** WordPress REST posts endpoint. */
  api: string;
  /** Optional case-insensitive event name match, to file posts under that event. */
  eventMatch?: string;
};

const SOURCES: NewsSource[] = [
  { author: "Red Cherry Events", api: "https://redcherryevents.co.za/wp-json/wp/v2/posts" },
  { author: "PE Plett", api: "https://peplett.co.za/wp-json/wp/v2/posts", eventMatch: "plett" },
];

function decodeEntities(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&#39;|&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&#8212;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

type WpPost = {
  id: number;
  date_gmt: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
};

export type NewsSyncSummary = {
  fetched: number;
  inserted: number;
  skipped: number;
  titles: string[];
  error?: string;
};

/** Fetch up to `limit` posts, following pagination in pages of 20. */
async function fetchPosts(api: string, limit: number): Promise<WpPost[]> {
  const out: WpPost[] = [];
  const perPage = Math.min(20, limit);
  for (let page = 1; out.length < limit && page <= 25; page += 1) {
    const res = await fetch(
      `${api}?per_page=${perPage}&page=${page}&_fields=id,date_gmt,link,title,excerpt&orderby=date&order=desc`,
      { headers: { "User-Agent": "RedCherryEventsApp/1.0", Accept: "application/json" } },
    );
    if (!res.ok) {
      if (page === 1) throw new Error(`News site returned ${res.status}`);
      break;
    }
    const batch = (await res.json()) as WpPost[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < perPage) break;
  }
  return out.slice(0, limit);
}

async function findEventId(admin: SupabaseClient, match: string): Promise<string | null> {
  const { data } = await admin
    .from("events")
    .select("id")
    .ilike("name", `%${match}%`)
    .order("event_date", { ascending: false })
    .limit(1);
  const row = (data ?? [])[0] as { id?: string } | undefined;
  return row?.id ?? null;
}

/** Pull the latest articles from every source and insert any we don't already have (matched on source URL). */
export async function syncWebsiteNews(
  admin: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<NewsSyncSummary> {
  const limit = opts.limit ?? 25;
  const summary: NewsSyncSummary = { fetched: 0, inserted: 0, skipped: 0, titles: [] };
  const errors: string[] = [];

  for (const source of SOURCES) {
    let posts: WpPost[] = [];
    try {
      posts = await fetchPosts(source.api, limit);
    } catch (err) {
      errors.push(`${source.author}: ${(err as Error).message}`);
      continue;
    }

    summary.fetched += posts.length;
    if (posts.length === 0) continue;

    const links = posts.map((p) => p.link).filter(Boolean);
    const { data: existing } = await admin
      .from("feed_posts")
      .select("source_url")
      .in("source_url", links);
    const known = new Set(
      (existing ?? []).map((r) => String((r as { source_url: string }).source_url)),
    );

    const eventId = source.eventMatch ? await findEventId(admin, source.eventMatch) : null;

    // Oldest first so ties in posted_at keep chronological order in the feed.
    for (const p of [...posts].reverse()) {
      if (!p.link || known.has(p.link)) {
        summary.skipped += 1;
        continue;
      }
      const title = decodeEntities(p.title?.rendered ?? "").trim();
      if (!title) {
        summary.skipped += 1;
        continue;
      }
      let excerpt = decodeEntities(p.excerpt?.rendered ?? "");
      // The excerpt often repeats the headline first — drop that duplication.
      if (excerpt.toLowerCase().startsWith(title.toLowerCase())) {
        excerpt = excerpt.slice(title.length).trim();
      }
      if (excerpt.length > 600) excerpt = `${excerpt.slice(0, 597).trimEnd()}…`;

      const body = `${excerpt}\n\nRead the full article: ${p.link}`;
      const { error } = await admin.from("feed_posts").insert({
        post_type: "news",
        title,
        body,
        author: source.author,
        posted_at: new Date(`${p.date_gmt}Z`).toISOString(),
        pinned: false,
        source_url: p.link,
        ...(eventId ? { event_id: eventId } : {}),
      });
      if (error) {
        summary.skipped += 1;
        continue;
      }
      summary.inserted += 1;
      summary.titles.push(title);
    }
  }

  if (errors.length) summary.error = errors.join("; ");
  return summary;
}
