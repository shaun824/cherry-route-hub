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

    // Google serves a JavaScript interstitial (no redirect) to desktop-browser
    // user agents, so try simple clients first — those still get a plain 302 to
    // the full maps.google.com URL that carries the coordinates.
    const agents = [
      "curl/8.4.0",
      "facebookexternalhit/1.1",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    ];

    let finalUrl = start;
    for (const ua of agents) {
      try {
        const res = await fetch(start, {
          redirect: "follow",
          headers: { "User-Agent": ua, Accept: "text/html,*/*" },
        });
        const candidate = res.url || start;
        if (coordsFromMapUrl(candidate)) {
          finalUrl = candidate;
          break;
        }
        finalUrl = candidate;
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
      } catch (e) {
        console.warn("[map-link:resolve]", ua, e);
      }
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
