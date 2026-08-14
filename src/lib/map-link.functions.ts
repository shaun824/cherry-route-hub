import { createServerFn } from "@tanstack/react-start";
import { coordsFromMapUrl, placeFromMapUrl } from "@/lib/map-embed";

/**
 * Expands a shortened Google Maps link (maps.app.goo.gl / goo.gl/maps) into a
 * full URL and pulls coordinates out of it, so the app can embed the map.
 */
export const resolveMapLink = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => {
    const url = (input?.url ?? "").trim();
    if (!url) throw new Error("A link is required");
    if (url.length > 2000) throw new Error("Link is too long");
    return { url };
  })
  .handler(async ({ data }) => {
    const start = /^https?:\/\//i.test(data.url) ? data.url : `https://${data.url}`;

    let host: string;
    try {
      host = new URL(start).hostname.toLowerCase();
    } catch {
      return { ok: false as const, error: "That does not look like a valid link." };
    }
    const allowed = /(^|\.)(google\.[a-z.]+|goo\.gl)$/.test(host);
    if (!allowed) {
      return { ok: false as const, error: "Please paste a Google Maps link." };
    }

    let finalUrl = start;
    try {
      const res = await fetch(start, {
        redirect: "follow",
        headers: {
          // Google serves the coordinate-bearing URL to normal browsers.
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        },
      });
      finalUrl = res.url || start;
      if (!coordsFromMapUrl(finalUrl)) {
        const html = await res.text();
        const m =
          html.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
          html.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
          html.match(/"(-?\d{1,2}\.\d{4,})","(-?\d{1,3}\.\d{4,})"/);
        if (m) {
          return {
            ok: true as const,
            url: finalUrl,
            lat: Number(m[1]),
            lng: Number(m[2]),
            place: placeFromMapUrl(finalUrl),
          };
        }
      }
    } catch (e) {
      console.warn("[map-link:resolve]", e);
    }

    const point = coordsFromMapUrl(finalUrl);
    return {
      ok: true as const,
      url: finalUrl,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      place: placeFromMapUrl(finalUrl),
    };
  });
