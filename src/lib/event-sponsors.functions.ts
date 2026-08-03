import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const Input = z.object({ eventId: z.string().uuid() });

export type ScrapedSponsor = {
  name: string;
  logoUrl: string;
  linkUrl: string | null;
};

type Cached = { sponsors: ScrapedSponsor[]; source: string | null; fetchedAt: number };
const cache = new Map<string, Cached>();
const TTL_MS = 6 * 60 * 60 * 1000;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag);
  return m?.[1] ?? null;
}

function absolute(href: string | null, base: URL): string | null {
  if (!href) return null;
  try {
    return new URL(href.trim(), base).toString();
  } catch {
    return null;
  }
}

async function getHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RedCherryEventsBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(9000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

const SPONSOR_WORDS = /(sponsor|partner|supported\s*by|proudly\s*brought|in\s*association)/i;
const JUNK_IMG = /(logo-?(header|nav|site|main)|favicon|placeholder|spinner|loading|avatar|icon-|social|facebook|instagram|twitter|youtube|whatsapp|arrow|banner-?ad)/i;

/** Pull <img> tags that sit inside markup mentioning sponsors/partners. */
function extractSponsors(html: string, base: URL): ScrapedSponsor[] {
  const out = new Map<string, ScrapedSponsor>();

  // Candidate regions: blocks around a sponsor/partner heading or container.
  const regions: string[] = [];
  const containerRe =
    /<(section|div|footer|ul|aside)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:sponsor|partner)[^"']*["'][^>]*>([\s\S]{0,20000}?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = containerRe.exec(html))) regions.push(m[2] ?? "");

  const headingRe = /<h[1-6][^>]*>([\s\S]{0,120}?)<\/h[1-6]>/gi;
  while ((m = headingRe.exec(html))) {
    if (SPONSOR_WORDS.test(decodeEntities((m[1] ?? "").replace(/<[^>]+>/g, " ")))) {
      regions.push(html.slice(m.index, m.index + 20000));
    }
  }

  // Fallback: images whose src/alt/class mention sponsor.
  if (regions.length === 0) regions.push(html);

  for (const region of regions) {
    const anchorImgRe = /<a\b([^>]*)>([\s\S]{0,4000}?)<\/a>/gi;
    let a: RegExpExecArray | null;
    while ((a = anchorImgRe.exec(region))) {
      const aTag = `<a ${a[1] ?? ""}>`;
      const inner = a[2] ?? "";
      const imgMatch = /<img\b[^>]*>/i.exec(inner);
      if (!imgMatch) continue;
      addImg(imgMatch[0], absolute(attr(aTag, "href"), base));
    }
    const imgRe = /<img\b[^>]*>/gi;
    let i: RegExpExecArray | null;
    while ((i = imgRe.exec(region))) addImg(i[0], null);
  }

  function addImg(imgTag: string, linkUrl: string | null) {
    const rawSrc =
      attr(imgTag, "src") ??
      attr(imgTag, "data-src") ??
      attr(imgTag, "data-lazy-src") ??
      (attr(imgTag, "srcset") ?? attr(imgTag, "data-srcset") ?? "").split(",")[0]?.trim().split(" ")[0] ??
      null;
    const src = absolute(rawSrc && rawSrc.length > 0 ? rawSrc : null, base);
    if (!src) return;
    if (src.startsWith("data:")) return;
    const alt = decodeEntities(attr(imgTag, "alt") ?? "");
    const cls = attr(imgTag, "class") ?? "";
    const haystack = `${src} ${alt} ${cls}`;
    if (JUNK_IMG.test(haystack) && !SPONSOR_WORDS.test(haystack)) return;
    if (out.has(src)) {
      if (linkUrl && !out.get(src)!.linkUrl) out.get(src)!.linkUrl = linkUrl;
      return;
    }
    const fallbackName = decodeEntities(
      (src.split("/").pop() ?? "Sponsor").replace(/\.[a-z0-9]+(\?.*)?$/i, "").replace(/[-_]+/g, " "),
    );
    out.set(src, {
      name: (alt || fallbackName || "Sponsor").slice(0, 60),
      logoUrl: src,
      linkUrl: linkUrl && !linkUrl.startsWith(base.origin) ? linkUrl : linkUrl,
    });
  }

  return Array.from(out.values()).slice(0, 40);
}

function findSponsorPage(html: string, base: URL): string | null {
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1] ?? "";
    const label = decodeEntities((m[2] ?? "").replace(/<[^>]+>/g, " "));
    if (SPONSOR_WORDS.test(label) || /sponsor|partner/i.test(href)) {
      const url = absolute(href, base);
      if (url && new URL(url).hostname === base.hostname) return url;
    }
  }
  return null;
}

export const fetchEventSponsors = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const url = process.env["SUPABASE_URL"]!;
    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: event } = await supabase
      .from("events")
      .select("website_url")
      .eq("id", data.eventId)
      .maybeSingle();

    const website = event?.website_url ?? null;
    if (!website) return { sponsors: [] as ScrapedSponsor[], source: null as string | null };

    let base: URL;
    try {
      base = new URL(website.startsWith("http") ? website : `https://${website}`);
    } catch {
      return { sponsors: [] as ScrapedSponsor[], source: null as string | null };
    }

    const cached = cache.get(data.eventId);
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
      return { sponsors: cached.sponsors, source: cached.source };
    }

    const home = await getHtml(base.toString());
    let sponsors = home ? extractSponsors(home, base) : [];
    let source = base.toString();

    if (home && sponsors.length < 3) {
      const sponsorPage = findSponsorPage(home, base);
      if (sponsorPage) {
        const page = await getHtml(sponsorPage);
        if (page) {
          const more = extractSponsors(page, new URL(sponsorPage));
          const seen = new Set(sponsors.map((s) => s.logoUrl));
          sponsors = [...sponsors, ...more.filter((s) => !seen.has(s.logoUrl))];
          source = sponsorPage;
        }
      }
    }

    cache.set(data.eventId, { sponsors, source, fetchedAt: Date.now() });
    return { sponsors, source };
  });
