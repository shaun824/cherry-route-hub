/** Helpers for turning pasted Google Maps links into embeddable map sources. */

export type MapPoint = { lat: number; lng: number };

/** Parse decimal or degree-minute-second coordinates pasted from Google Maps. */
export function coordsFromMapInput(value: string): MapPoint | null {
  const input = value.trim();
  if (!input) return null;

  const decimal = input.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (decimal) {
    const lat = Number(decimal[1]);
    const lng = Number(decimal[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }

  const matches = [...input.matchAll(/(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′’]\s*(\d+(?:\.\d+)?)\s*["″”]?\s*([NSEW])/gi)];
  if (matches.length !== 2) return null;

  const values = matches.map((match) => {
    const degrees = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const direction = match[4].toUpperCase();
    if (minutes >= 60 || seconds >= 60) return null;
    const magnitude = degrees + minutes / 60 + seconds / 3600;
    return { value: /[SW]/.test(direction) ? -magnitude : magnitude, direction };
  });
  const latitude = values.find((item) => item && /[NS]/.test(item.direction));
  const longitude = values.find((item) => item && /[EW]/.test(item.direction));
  if (!latitude || !longitude || Math.abs(latitude.value) > 90 || Math.abs(longitude.value) > 180) return null;
  return { lat: latitude.value, lng: longitude.value };
}

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

    const pastedPoint = coordsFromMapInput(raw);
    if (pastedPoint) return `https://www.google.com/maps?q=${pastedPoint.lat},${pastedPoint.lng}&z=15&output=embed`;

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
  const pastedPoint = coordsFromMapInput(raw);
  if (pastedPoint) {
    return `https://www.google.com/maps/search/?api=1&query=${pastedPoint.lat},${pastedPoint.lng}`;
  }
  if (typeof opts.lat === "number" && typeof opts.lng === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${opts.lat},${opts.lng}`;
  }
  const address = (opts.address ?? "").trim();
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return null;
}

/**
 * Best-effort coordinates for a venue from any of the stored fields.
 * Used to render a real map tile view instead of Google's keyless embed.
 */
export function resolveVenuePoint(opts: {
  mapUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
}): MapPoint | null {
  const raw = (opts.mapUrl ?? "").trim();
  if (raw) {
    const fromUrl = coordsFromMapUrl(raw) ?? coordsFromMapInput(raw);
    if (fromUrl) return fromUrl;
    const embedMatch = raw.match(/[?&](?:q|ll|center)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (embedMatch) return { lat: Number(embedMatch[1]), lng: Number(embedMatch[2]) };
  }
  if (typeof opts.lat === "number" && typeof opts.lng === "number") {
    return { lat: opts.lat, lng: opts.lng };
  }
  return null;
}
