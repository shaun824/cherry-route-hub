// Weekly pull of new articles from the Red Cherry Events website into the app news feed.
// Server-only: never import from client code.
import type { SupabaseClient } from "@supabase/supabase-js";

const NEWS_API = "https://redcherryevents.co.za/wp-json/wp/v2/posts";

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

/** Pull the latest articles and insert any we don't already have (matched on source URL). */
export async function syncWebsiteNews(
  admin: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<NewsSyncSummary> {
  const limit = opts.limit ?? 10;
  const summary: NewsSyncSummary = { fetched: 0, inserted: 0, skipped: 0, titles: [] };

  let posts: WpPost[] = [];
  try {
    const res = await fetch(
      `${NEWS_API}?per_page=${limit}&_fields=id,date_gmt,link,title,excerpt&orderby=date&order=desc`,
      { headers: { "User-Agent": "RedCherryEventsApp/1.0", Accept: "application/json" } },
    );
    if (!res.ok) {
      summary.error = `News site returned ${res.status}`;
      return summary;
    }
    posts = (await res.json()) as WpPost[];
  } catch (err) {
    summary.error = (err as Error).message;
    return summary;
  }

  summary.fetched = posts.length;
  if (posts.length === 0) return summary;

  const links = posts.map((p) => p.link).filter(Boolean);
  const { data: existing } = await admin
    .from("feed_posts")
    .select("source_url")
    .in("source_url", links);
  const known = new Set((existing ?? []).map((r) => String((r as { source_url: string }).source_url)));

  for (const p of posts) {
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
      author: "Red Cherry Events",
      posted_at: new Date(`${p.date_gmt}Z`).toISOString(),
      pinned: false,
      source_url: p.link,
    });
    if (error) {
      summary.skipped += 1;
      continue;
    }
    summary.inserted += 1;
    summary.titles.push(title);
  }

  return summary;
}
