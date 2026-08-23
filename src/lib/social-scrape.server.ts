// Pulls the Instagram posts each event website already embeds / links to, so the
// app can show a live-ish social wall without needing Instagram API tokens.
// Server-only.
import type { SupabaseClient } from "@supabase/supabase-js";

const POST_RE = /https?:\/\/(?:www\.)?instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]{5,})/g;
const PROFILE_RE = /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]{2,30})\/?/g;

export type ScrapedSocial = {
  posts: string[];
  instagram?: string | null;
  facebook?: string | null;
};

async function getHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) return "";
  return await res.text();
}

/** Scrape one website (plus a couple of likely sub-pages) for Instagram content. */
export async function scrapeSocialFromSite(siteUrl: string): Promise<ScrapedSocial> {
  const base = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
  const candidates = [base, new URL("/gallery/", base).toString(), new URL("/news/", base).toString()];

  const posts = new Set<string>();
  let instagram: string | null = null;
  let facebook: string | null = null;

  for (const url of candidates) {
    let html = "";
    try {
      html = await getHtml(url);
    } catch {
      continue;
    }
    if (!html) continue;

    for (const m of html.matchAll(POST_RE)) {
      posts.add(`https://www.instagram.com/${m[1]}/${m[2]}/`);
    }
    if (!instagram) {
      for (const m of html.matchAll(PROFILE_RE)) {
        const handle = m[1];
        if (["p", "reel", "tv", "explore", "accounts", "embed"].includes(handle)) continue;
        instagram = `https://www.instagram.com/${handle}/`;
        break;
      }
    }
    if (!facebook) {
      const fb = html.match(/https?:\/\/(?:www\.)?facebook\.com\/([A-Za-z0-9_.-]{3,})/);
      if (fb && !["sharer.php", "tr", "plugins", "dialog"].includes(fb[1])) {
        facebook = `https://www.facebook.com/${fb[1]}`;
      }
    }
    if (posts.size >= 12) break;
  }

  return { posts: [...posts].slice(0, 12), instagram, facebook };
}

type EventRow = {
  id: string;
  name: string;
  website_url: string | null;
  social_links: Record<string, string> | null;
};

/** Refresh the stored social wall for one event. Returns how many posts we hold. */
export async function syncEventSocial(
  admin: SupabaseClient,
  event: EventRow,
): Promise<{ eventId: string; name: string; posts: number; instagram: string | null }> {
  const sources = [event.website_url, event.social_links?.website].filter(
    (u): u is string => typeof u === "string" && u.trim().length > 0,
  );

  const found = new Set<string>();
  let instagram = event.social_links?.instagram ?? null;
  let facebook = event.social_links?.facebook ?? null;

  for (const src of sources) {
    try {
      const res = await scrapeSocialFromSite(src);
      res.posts.forEach((p) => found.add(p));
      if (!instagram && res.instagram) instagram = res.instagram;
      if (!facebook && res.facebook) facebook = res.facebook;
    } catch {
      /* ignore a dead site */
    }
  }

  if (instagram !== (event.social_links?.instagram ?? null) || facebook !== (event.social_links?.facebook ?? null)) {
    await admin
      .from("events")
      .update({
        social_links: {
          ...(event.social_links ?? {}),
          ...(instagram ? { instagram } : {}),
          ...(facebook ? { facebook } : {}),
        },
      })
      .eq("id", event.id);
  }

  const rows = [...found].map((url, i) => ({
    event_id: event.id,
    platform: "instagram",
    post_url: url,
    sort_index: i,
    active: true,
    source: "website",
  }));

  if (rows.length) {
    // Replace the website-sourced wall so removed posts drop away, keep manual ones.
    await admin.from("event_social_posts").delete().eq("event_id", event.id).eq("source", "website");
    await admin.from("event_social_posts").insert(rows);
  }

  return { eventId: event.id, name: event.name, posts: rows.length, instagram };
}

/** Refresh every live event's social wall. */
export async function syncAllEventSocial(admin: SupabaseClient) {
  const { data } = await admin
    .from("events")
    .select("id, name, website_url, social_links")
    .neq("lifecycle", "archived");
  const results = [];
  for (const event of (data ?? []) as EventRow[]) {
    results.push(await syncEventSocial(admin, event));
  }
  return results;
}
