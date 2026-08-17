// Thin server-function wrapper for elevation lookups. All runtime helpers live
// in elevation.server.ts so the server-fn splitter can't drop them.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { lookupElevations, summarise } from "./elevation.server";

export const getRouteElevation = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        // [lng, lat] pairs sampled along the route
        coords: z.array(z.tuple([z.number(), z.number()])).min(2).max(400),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const elevations = await lookupElevations(data.coords as [number, number][]);
    if (!elevations) {
      console.error("[elevation] all terrain providers failed");
      return { available: false as const, reason: "Elevation profile is temporarily unavailable." };
    }
    return { available: true as const, ...summarise(elevations) };
  });
