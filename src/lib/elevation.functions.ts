// Server function that fetches an elevation profile from Google Maps Elevation
// API through the Lovable connector gateway. Called from the map component
// when a KML has no altitude values.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getRouteElevation = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z.object({
      // [lng, lat] pairs sampled along the route
      coords: z.array(z.tuple([z.number(), z.number()])).min(2).max(400),
    }).parse(raw),
  )
  .handler(async ({ data }) => {
    let elevations: number[] = [];
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const gmapsKey = process.env["GOOGLE_MAPS_API_KEY"];

    if (lovableKey && gmapsKey) {
      const locations = data.coords.map(([lng, lat]) => `${lat},${lng}`).join("|");
      const url = `https://connector-gateway.lovable.dev/google_maps/maps/api/elevation/json?locations=${encodeURIComponent(locations)}`;
      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": gmapsKey,
          },
        });
        if (response.ok) {
          const payload = (await response.json()) as {
            status?: string;
            results?: { elevation?: number }[];
          };
          if (payload.status === "OK" && payload.results) {
            elevations = payload.results.map((result) => result.elevation ?? 0);
          }
        }
      } catch (error) {
        console.warn("[elevation] Google elevation lookup failed", error);
      }
    }

    // Route files commonly contain only latitude/longitude. Use Open-Meteo's
    // terrain model when Google is unavailable; requests are capped at 100
    // coordinates, so process longer profiles in ordered batches.
    if (elevations.length !== data.coords.length) {
      elevations = [];
      try {
        for (let start = 0; start < data.coords.length; start += 100) {
          const batch = data.coords.slice(start, start + 100);
          const params = new URLSearchParams({
            latitude: batch.map(([, lat]) => lat).join(","),
            longitude: batch.map(([lng]) => lng).join(","),
          });
          const response = await fetch(`https://api.open-meteo.com/v1/elevation?${params}`);
          if (!response.ok) throw new Error(`Terrain lookup failed (${response.status})`);
          const payload = (await response.json()) as { elevation?: number[] };
          if (!payload.elevation || payload.elevation.length !== batch.length) {
            throw new Error("Terrain lookup returned an incomplete profile");
          }
          elevations.push(...payload.elevation);
        }
      } catch (error) {
        console.error("[elevation] terrain lookup failed", error);
        return { available: false as const, reason: "Elevation profile is temporarily unavailable." };
      }
    }

    // Total ascent using a 1.5m noise threshold.
    let gain = 0;
    let last: number | null = null;
    for (const elevation of elevations) {
      if (last !== null) {
        const d = elevation - last;
        if (d > 1.5) gain += d;
      }
      last = elevation;
    }

    return {
      available: true as const,
      totalGainM: Math.round(gain),
      profile: elevations,
    };
  });
