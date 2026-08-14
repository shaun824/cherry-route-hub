/** Helpers for turning pasted Google Maps links into embeddable map sources. */

export type MapPoint = { lat: number; lng: number };

export function isShortMapLink(url: string): boolean {
  return /^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(url.trim());
}

function clean(url: string): string {
  const t = url.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Pull coordinates out of a full Google Maps URL (several known shapes). */
export function coordsFromMapUrl(url: string): MapPoint | null {
  const u = clean(url);
  if (!u) return null;

  // .../@-33.123,18.456,15z
  const at = u.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };

  // ...!3d-33.123!4d18.456
  const bang = u.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bang) return { lat: Number(bang[1]), lng: Number(bang[2]) };

  // ?q=-33.123,18.456 or ?query=... or ?ll=... or ?center=...
  try {
    const parsed = new URL(u);
    for (const key of ["q", "query", "ll", "center", "destination", "viewpoint"]) {
      const raw = parsed.searchParams.get(key);
      if (!raw) continue;
      const m = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
      if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Human-readable place name from a /place/<name>/ segment. */
export function placeFromMapUrl(url: string): string | null {
  const m = clean(url).match(/\/place\/([^/@?]+)/);
  if (!m || !m[1]) return null;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, " "));
  } catch {
    return m[1].replace(/\+/g, " ");
  }
}

/**
 * Build an iframe src for the venue map.
 * Accepts a pasted Google Maps URL, an already-built embed URL, coordinates,
 * or a plain address. Returns null when there is nothing to show.
 */
export function buildMapEmbedSrc(opts: {
  mapUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
}): string | null {
  const raw = (opts.mapUrl ?? "").trim();

  if (raw) {
    // Already an embeddable URL — use as-is.
    if (/\/maps\/embed/i.test(raw) || /output=embed/i.test(raw)) return clean(raw);

    // <iframe src="..."> pasted straight from Google's share dialog.
    const iframeSrc = raw.match(/src=["']([^"']+)["']/i);
    if (iframeSrc?.[1]) return iframeSrc[1];

    const point = coordsFromMapUrl(raw);
    if (point) return `https://www.google.com/maps?q=${point.lat},${point.lng}&z=15&output=embed`;

    const place = placeFromMapUrl(raw);
    if (place) return `https://www.google.com/maps?q=${encodeURIComponent(place)}&output=embed`;
    // Short links (maps.app.goo.gl) cannot be embedded — fall through to
    // coordinates/address below.
  }

  if (typeof opts.lat === "number" && typeof opts.lng === "number") {
    return `https://www.google.com/maps?q=${opts.lat},${opts.lng}&z=15&output=embed`;
  }

  const address = (opts.address ?? "").trim();
  if (address) return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;

  return null;
}

/** Link to open in the Google Maps app / site. */
export function buildMapLink(opts: {
  mapUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
}): string | null {
  const raw = (opts.mapUrl ?? "").trim();
  if (raw && /^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps)/i.test(raw)) {
    return clean(raw);
  }
  if (typeof opts.lat === "number" && typeof opts.lng === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${opts.lat},${opts.lng}`;
  }
  const address = (opts.address ?? "").trim();
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return null;
}
