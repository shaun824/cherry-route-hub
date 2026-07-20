// Server function that fetches an elevation profile from Google Maps Elevation
// API through the Lovable connector gateway. Called from the map component
// when a KML has no altitude values.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  // [lng, lat] pairs sampled along the route
  coords: z
    .array(z.tuple([z.number(), z.number()]))
    .min(2)
    .max(400),
});

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export const getRouteElevation = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => schema.parse(raw))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !gmapsKey) {
      return {
        available: false as const,
        reason: "Google Maps Platform is not connected on this project.",
      };
    }

    // Google Elevation API accepts up to 512 locations per request.
    const locations = data.coords
      .map(([lng, lat]) => `${lat},${lng}`)
      .join("|");
    const url = `${GATEWAY_URL}/maps/api/elevation/json?locations=${encodeURIComponent(locations)}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmapsKey,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[elevation] gateway ${res.status}: ${body}`);
      return { available: false as const, reason: `Elevation request failed (${res.status}).` };
    }
    const payload = (await res.json()) as {
      status?: string;
      results?: { elevation?: number; location?: { lat: number; lng: number } }[];
      error_message?: string;
    };
    if (payload.status !== "OK" || !payload.results) {
      return { available: false as const, reason: payload.error_message ?? "No elevation results." };
    }
    const points = payload.results.map((r, i) => ({
      lng: r.location?.lng ?? data.coords[i][0],
      lat: r.location?.lat ?? data.coords[i][1],
      elevation: r.elevation ?? 0,
    }));

    // Total ascent using a 1.5m noise threshold.
    let gain = 0;
    let last: number | null = null;
    for (const p of points) {
      if (last !== null) {
        const d = p.elevation - last;
        if (d > 1.5) gain += d;
      }
      last = p.elevation;
    }

    return {
      available: true as const,
      totalGainM: Math.round(gain),
      profile: points.map((p) => p.elevation),
    };
  });
