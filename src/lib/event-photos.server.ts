// Reads a public Google Photos shared album page and extracts the photo URLs.
// We never download or store the images themselves — only their CDN base URLs,
// which are re-fetched periodically because Google rotates them.

export type AlbumPhoto = {
  id: string;
  baseUrl: string;
  width: number;
  height: number;
};

const MAX_PHOTOS = 200;

export function isGooglePhotosAlbumUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return /(^|\.)google\.com$/.test(u.hostname) && /\/share\/|\/album\//.test(u.pathname)
      ? true
      : /(^|\.)goo\.gl$|photos\.app\.goo\.gl$|photos\.google\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}

async function fetchAlbumHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        // A desktop UA gets the full embedded photo payload.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-ZA,en;q=0.9",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// The album page embeds entries shaped roughly like:
//   ["AF1Qip...","https://lh3.googleusercontent.com/pw/XXXX",4000,3000, ...]
const ENTRY_RE =
  /"(https:\/\/lh3\.googleusercontent\.com\/[^"\\\s]+)"\s*,\s*(\d{2,5})\s*,\s*(\d{2,5})/g;

export function parseAlbumHtml(html: string): AlbumPhoto[] {
  const out: AlbumPhoto[] = [];
  const seen = new Set<string>();

  for (const m of html.matchAll(ENTRY_RE)) {
    const raw = m[1];
    const width = Number(m[2]);
    const height = Number(m[3]);
    if (!raw || !Number.isFinite(width) || !Number.isFinite(height)) continue;
    // Skip avatars / tiny UI assets.
    if (width < 300 || height < 300) continue;
    const baseUrl = raw.split("=")[0]!.replace(/\\u003d.*$/, "");
    if (!baseUrl.includes("/pw/") && !baseUrl.includes("/p/") && !baseUrl.includes("/d/")) {
      // still allow, but only if it looks like a photo path
      if (!/lh3\.googleusercontent\.com\/[A-Za-z0-9_-]{20,}/.test(baseUrl)) continue;
    }
    if (seen.has(baseUrl)) continue;
    seen.add(baseUrl);
    out.push({ id: baseUrl.slice(-24), baseUrl, width, height });
    if (out.length >= MAX_PHOTOS) break;
  }

  return out;
}

export async function crawlGooglePhotosAlbum(
  albumUrl: string,
): Promise<{ photos: AlbumPhoto[]; error: string | null }> {
  const html = await fetchAlbumHtml(albumUrl);
  if (!html) return { photos: [], error: "Could not load the album page. Is the link shared publicly?" };
  const photos = parseAlbumHtml(html);
  if (photos.length === 0) {
    return {
      photos: [],
      error: "No photos found in that album. Make sure the album is shared with 'Anyone with the link'.",
    };
  }
  return { photos, error: null };
}
