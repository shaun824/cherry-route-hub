// Shared crawler + daily knowledge-base cache for the event assistant.
// Server-only: never import from client code.
import type { SupabaseClient } from "@supabase/supabase-js";

// ---------- HTML → text ----------

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinks(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:"))
      continue;
    try {
      const u = new URL(href, base);
      if (u.hostname !== base.hostname) continue;
      // Skip binary/asset extensions.
      if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|mp3|ico|css|js)(\?|$)/i.test(u.pathname)) continue;
      u.hash = "";
      out.add(u.toString());
    } catch {
      /* ignore */
    }
  }
  return Array.from(out);
}

// ---------- multi-page scrape with cache ----------

type CachedPage = { text: string; html: string; fetchedAt: number };
const pageCache = new Map<string, CachedPage>();
const PAGE_TTL_MS = 15 * 60 * 1000; // 15 min

async function fetchPage(url: string): Promise<CachedPage | null> {
  const cached = pageCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < PAGE_TTL_MS) return cached;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RedCherryEventsBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    const html = await res.text();
    const text = stripHtmlToText(html);
    const page = { text, html, fetchedAt: Date.now() };
    pageCache.set(url, page);
    return page;
  } catch {
    return null;
  }
}

// Score links by how likely they are to contain rider-relevant info.
function scoreLink(url: string): number {
  const u = url.toLowerCase();
  let score = 0;
  const keywords = [
    "faq",
    "info",
    "rider",
    "route",
    "schedule",
    "programme",
    "program",
    "venue",
    "accommodation",
    "camp",
    "package",
    "package",
    "entry",
    "entries",
    "price",
    "prize",
    "category",
    "categories",
    "rules",
    "safety",
    "medical",
    "start",
    "finish",
    "distance",
    "elevation",
    "map",
    "gpx",
    "kml",
    "kit",
    "pack",
    "seed",
    "batch",
    "sponsor",
    "about",
    "contact",
    "logistics",
    "transfer",
    "shuttle",
    "food",
    "meal",
    "beverage",
    "water",
    "waterpoint",
    "check-in",
    "registration",
    "day-1",
    "day-2",
    "day-3",
    "day1",
    "day2",
    "day3",
    "package",
    "packages",
    "enter-here",
    "enter",
    "transport",
    "transfer",
    "bike",
    "bikes",
    "luggage",
    "tour",
    "itinerary",
  ];
  for (const k of keywords) if (u.includes(k)) score += 3;
  // Prefer shallow paths.
  const depth = (new URL(url).pathname.match(/\//g)?.length ?? 1) - 1;
  score -= depth;
  return score;
}

async function fetchSitemapUrls(seedUrls: string[]): Promise<string[]> {
  const out = new Set<string>();
  const origins = new Set<string>();
  for (const s of seedUrls) {
    try {
      origins.add(new URL(s).origin);
    } catch {
      /* ignore */
    }
  }
  for (const origin of origins) {
    for (const path of ["/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"]) {
      try {
        const res = await fetch(origin + path, { signal: AbortSignal.timeout(8000), redirect: "follow" });
        if (!res.ok) continue;
        const xml = await res.text();
        const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(xml))) {
          const loc = m[1]!;
          if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|mp3|ico|css|js)(\?|$)/i.test(loc)) continue;
          if (loc.endsWith(".xml")) {
            // nested sitemap: fetch one level deep
            try {
              const sub = await fetch(loc, { signal: AbortSignal.timeout(8000) });
              if (sub.ok) {
                const subXml = await sub.text();
                const re2 = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
                let m2: RegExpExecArray | null;
                while ((m2 = re2.exec(subXml))) {
                  const l2 = m2[1]!;
                  if (!l2.endsWith(".xml")) out.add(l2);
                }
              }
            } catch {
              /* ignore */
            }
            continue;
          }
          out.add(loc);
        }
      } catch {
        /* ignore */
      }
    }
  }
  return Array.from(out);
}

export async function crawlSite(seedUrls: string[], maxPages = 40): Promise<{ url: string; text: string }[]> {
  const visited = new Set<string>();
  const results: { url: string; text: string }[] = [];
  const queue: string[] = [];

  for (const s of seedUrls) if (s) queue.push(s);

  // Discover the full URL set from sitemaps where available.
  const sitemapUrls = await fetchSitemapUrls(seedUrls);
  for (const u of sitemapUrls.sort((a, b) => scoreLink(b) - scoreLink(a))) {
    if (!queue.includes(u)) queue.push(u);
  }

  // BFS: every fetched page also contributes its own links.
  while (queue.length && results.length < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    const page = await fetchPage(url);
    if (!page) continue;
    if (page.text.length >= 120) results.push({ url, text: page.text });

    const links = extractLinks(page.html, url)
      .filter((l) => !visited.has(l) && !queue.includes(l))
      .map((l) => ({ l, score: scoreLink(l) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((x) => x.l);
    for (const l of links) queue.push(l);
  }

  return results;
}

// ---------- knowledge base ----------

export const KNOWLEDGE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // refresh every 3 days
const TOTAL_CAP = 90000;
const PER_PAGE_CAP = 9000;


export function buildKnowledgeText(pages: { url: string; text: string }[]): string {
  let used = 0;
  const parts: string[] = [];
  for (const p of pages) {
    if (used >= TOTAL_CAP) break;
    const slice = p.text.slice(0, Math.min(PER_PAGE_CAP, TOTAL_CAP - used));
    parts.push(`SOURCE: ${p.url}\n${slice}`);
    used += slice.length;
  }
  return parts.join("\n\n---\n\n");
}

type EventRow = { id: string; name?: string | null; website_url?: string | null; faq_url?: string | null };

/** Crawl an event's official site(s) and persist the result as its knowledge base. */
export async function refreshEventKnowledge(
  admin: SupabaseClient<any>,
  event: EventRow,
  maxPages = 40,
): Promise<{ eventId: string; pages: number; chars: number; error?: string }> {
  const seeds = [event.website_url, event.faq_url]
    .filter((u): u is string => Boolean(u && /^https?:\/\//i.test(u)));

  if (!seeds.length) {
    await admin.from("event_bot_knowledge").upsert({
      event_id: event.id,
      content: "",
      sources: [],
      refreshed_at: new Date().toISOString(),
      last_error: "No website configured",
    });
    return { eventId: event.id, pages: 0, chars: 0, error: "No website configured" };
  }

  try {
    const pages = await crawlSite(seeds, maxPages);
    const content = buildKnowledgeText(pages);
    await admin.from("event_bot_knowledge").upsert({
      event_id: event.id,
      content,
      sources: pages.map((p) => p.url),
      refreshed_at: new Date().toISOString(),
      last_error: pages.length ? null : "Crawl returned no readable pages",
    });
    return { eventId: event.id, pages: pages.length, chars: content.length };
  } catch (err) {
    const message = (err as Error).message;
    await admin.from("event_bot_knowledge").upsert({
      event_id: event.id,
      content: "",
      sources: [],
      refreshed_at: new Date().toISOString(),
      last_error: message,
    });
    return { eventId: event.id, pages: 0, chars: 0, error: message };
  }
}

/** Read the cached knowledge base, refreshing it when it's missing or older than a day. */
export async function getEventKnowledge(admin: SupabaseClient<any>, event: EventRow): Promise<string> {
  const { data } = await admin
    .from("event_bot_knowledge")
    .select("content, refreshed_at")
    .eq("event_id", event.id)
    .maybeSingle();

  const fresh =
    data?.refreshed_at && Date.now() - new Date(data.refreshed_at as string).getTime() < KNOWLEDGE_MAX_AGE_MS;

  if (fresh) return (data?.content as string) ?? "";

  await refreshEventKnowledge(admin, event);
  const { data: updated } = await admin
    .from("event_bot_knowledge")
    .select("content")
    .eq("event_id", event.id)
    .maybeSingle();
  return ((updated?.content as string) ?? (data?.content as string) ?? "");
}

/** Refresh every event that has a website configured (used by the daily cron). */
export async function refreshAllEventKnowledge(admin: SupabaseClient<any>) {
  const { data: events, error } = await admin
    .from("events")
    .select("id, name, website_url, faq_url")
    .neq("lifecycle", "archived");
  if (error) throw new Error(error.message);

  const results = [];
  for (const ev of events ?? []) {
    results.push(await refreshEventKnowledge(admin, ev as EventRow));
  }
  return { events: results.length, results };
}
