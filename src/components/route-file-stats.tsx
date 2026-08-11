// Shows a route's distance + elevation gain computed from its uploaded KML
// file(s), so the listed numbers always match the interactive map. Falls back to
// the admin-entered values while loading or when no file is available.
import { useEffect, useState } from "react";
import { Activity, Mountain } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  parseKml,
  polylineElevationGainM,
  polylineKm,
  samplePolyline,
  type LatLngAlt,
} from "@/lib/geo";
import { getRouteElevation } from "@/lib/elevation.functions";
import type { EventRoute } from "@/lib/mock-data";

export function RouteFileStats({ route }: { route: EventRoute }) {
  const kmls = route.kmlUrls ?? [];
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [gainM, setGainM] = useState<number | null>(null);
  const fetchElev = useServerFn(getRouteElevation);

  useEffect(() => {
    if (kmls.length === 0) return;
    let cancelled = false;
    (async () => {
      const lines: LatLngAlt[][] = [];
      for (const url of kmls) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const layer = parseKml(await res.text());
          for (const line of layer.lines) lines.push(line);
        } catch (err) {
          console.warn("[route-file-stats] failed to load", url, err);
        }
      }
      if (cancelled || lines.length === 0) return;
      setDistanceKm(lines.reduce((acc, l) => acc + polylineKm(l), 0));

      const fromKml = lines.reduce<number | null>((acc, l) => {
        const g = polylineElevationGainM(l);
        if (g === null) return acc;
        return (acc ?? 0) + g;
      }, null);
      if (fromKml !== null) {
        setGainM(fromKml);
        return;
      }
      const merged = lines.flat();
      if (merged.length < 2) return;
      const coords = samplePolyline(merged, 200).map(([lng, lat]) => [lng, lat] as [number, number]);
      try {
        const res = await fetchElev({ data: { coords } });
        if (!cancelled && res.available) setGainM(res.totalGainM);
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kmls.join("|")]);

  const shownDistance = distanceKm ?? (route.distanceKm ? Number(route.distanceKm) : null);
  const shownGain = gainM ?? (route.elevationM ? Number(route.elevationM) : null);

  if (!shownDistance && !shownGain) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-soft">
      {shownDistance ? (
        <span className="inline-flex items-center gap-1">
          <Activity className="h-3.5 w-3.5 text-cherry" />
          {shownDistance.toFixed(1)} km
        </span>
      ) : null}
      {shownGain ? (
        <span className="inline-flex items-center gap-1">
          <Mountain className="h-3.5 w-3.5 text-cherry" />
          {Math.round(shownGain).toLocaleString("en-ZA")} m climbing
        </span>
      ) : null}
    </div>
  );
}
