// Server-only: reads the sponsors/partners section off an event website so the
// crew training course can name every sponsor and what they do for the event.

export type ScrapedEventSponsor = {
  name: string;
  url: string | null;
  /** Nearby wording from the site that hints at what this sponsor provides. */
  context: string | null;
  tierHint: string | null;
};

const SPONSOR_WORDS = /(sponsor|partner|supported\s*by|proudly\s*brought|in\s*association|official\s+\w+)/i;
const JUNK =
  /(favicon|placeholder|spinner|loading|avatar|icon-|social|facebook|instagram|twitter|youtube|whatsapp|arrow|banner-?ad|logo-?(header|nav|site|main))/i;
const TIER = /(title|presenting|platinum|gold|silver|bronze|main|official|associate|media|hospitality|technical)\s+(sponsor|partner)/i;

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string): string | null {
  return new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag)?.[1] ?? null;
}

function abs(href: string | null, base: URL): string | null {
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

function nameFromSrc(src: string): string {
  return decode(
    (src.split("/").pop() ?? "").replace(/\.[a-z0-9]+(\?.*)?$/i, "").replace(/[-_]+/g, " ").replace(/\b\d{2,}\b/g, ""),
  ).trim();
}

function collect(html: string, base: URL, out: Map<string, ScrapedEventSponsor>) {
  // Regions of the page that talk about sponsors/partners.
  const regions: string[] = [];
  const containerRe =
    /<(section|div|footer|ul|aside)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:sponsor|partner)[^"']*["'][^>]*>([\s\S]{0,25000}?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = containerRe.exec(html))) regions.push(m[2] ?? "");

  const headingRe = /<h[1-6][^>]*>([\s\S]{0,160}?)<\/h[1-6]>/gi;
  while ((m = headingRe.exec(html))) {
    if (SPONSOR_WORDS.test(decode(m[1] ?? ""))) regions.push(html.slice(m.index, m.index + 20000));
  }
  if (!regions.length) return;

  for (const region of regions) {
    const tierHint = TIER.exec(decode(region).slice(0, 400))?.[0] ?? null;

    const anchorRe = /<a\b([^>]*)>([\s\S]{0,4000}?)<\/a>/gi;
    let a: RegExpExecArray | null;
    while ((a = anchorRe.exec(region))) {
      const tag = `<a ${a[1] ?? ""}>`;
      const inner = a[2] ?? "";
      const img = /<img\b[^>]*>/i.exec(inner)?.[0] ?? null;
      const link = abs(attr(tag, "href"), base);
      const label = decode(inner);
      let name = "";
      if (img) {
        const alt = decode(attr(img, "alt") ?? "");
        const src =
          attr(img, "src") ?? attr(img, "data-src") ?? attr(img, "data-lazy-src") ?? attr(img, "srcset")?.split(",")[0]?.trim().split(" ")[0] ?? "";
        if (JUNK.test(`${src} ${alt}`)) continue;
        name = alt || nameFromSrc(src);
      } else if (label && label.length <= 60 && !SPONSOR_WORDS.test(label)) {
        name = label;
      }
      name = name.replace(/\b(logo|logos|sponsor|partner)\b/gi, " ").replace(/\s+/g, " ").trim();
      if (name.length < 2 || name.length > 60) continue;
      const key = name.toLowerCase();
      const around = decode(region.slice(Math.max(0, a.index - 400), a.index + 600)).slice(0, 400);
      const existing = out.get(key);
      if (existing) {
        if (!existing.url && link) existing.url = link;
        if (!existing.tierHint && tierHint) existing.tierHint = tierHint;
        continue;
      }
      out.set(key, { name, url: link, context: around || null, tierHint });
    }

    // Logos that are not wrapped in links.
    const imgRe = /<img\b[^>]*>/gi;
    let i: RegExpExecArray | null;
    while ((i = imgRe.exec(region))) {
      const tag = i[0];
      const alt = decode(attr(tag, "alt") ?? "");
      const src = attr(tag, "src") ?? attr(tag, "data-src") ?? "";
      if (JUNK.test(`${src} ${alt}`)) continue;
      const name = (alt || nameFromSrc(src)).replace(/\b(logo|logos|sponsor|partner)\b/gi, " ").replace(/\s+/g, " ").trim();
      if (name.length < 2 || name.length > 60) continue;
      const key = name.toLowerCase();
      if (out.has(key)) continue;
      out.set(key, {
        name,
        url: null,
        context: decode(region.slice(Math.max(0, i.index - 400), i.index + 600)).slice(0, 400) || null,
        tierHint,
      });
    }
  }
}

function findSponsorPages(html: string, base: URL): string[] {
  const urls = new Set<string>();
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,140}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1] ?? "";
    const label = decode(m[2] ?? "");
    if (SPONSOR_WORDS.test(label) || /sponsor|partner/i.test(href)) {
      const url = abs(href, base);
      if (url && new URL(url).hostname === base.hostname) urls.add(url.split("#")[0]!);
    }
  }
  return Array.from(urls).slice(0, 3);
}

/** Sponsors named on an event website, with whatever the site says about each. */
export async function scrapeEventSponsors(websiteUrl: string | null | undefined): Promise<ScrapedEventSponsor[]> {
  if (!websiteUrl) return [];
  let base: URL;
  try {
    base = new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`);
  } catch {
    return [];
  }

  const out = new Map<string, ScrapedEventSponsor>();
  const home = await getHtml(base.toString());
  if (home) {
    collect(home, base, out);
    for (const page of findSponsorPages(home, base)) {
      if (out.size > 40) break;
      const html = await getHtml(page);
      if (html) collect(html, new URL(page), out);
    }
  }
  return Array.from(out.values()).slice(0, 40);
}
