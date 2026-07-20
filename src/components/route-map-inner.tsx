// Interactive route map. Client-only — lazy-loaded so Leaflet never runs during
// SSR. Given an event, fetches every KML referenced by its routes, parses them,
// renders coloured polylines, and shows total distance + total elevation gain
// (from KML altitude when available, otherwise Google Elevation API through the
// Lovable connector). Waypoints are NOT parsed from KML — only admin-added
// custom markers are rendered on top of the routes.
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useServerFn } from "@tanstack/react-start";
import type { CustomMarker, Event, EventRoute } from "@/lib/mock-data";
import {
  boundsFromCoords,
  parseKml,
  polylineElevationGainM,
  polylineKm,
  samplePolyline,
  simplifyPolyline,
  capPolyline,
  type LatLngAlt,
} from "@/lib/geo";
import { getRouteElevation } from "@/lib/elevation.functions";

// Fix Leaflet's default icon paths (Vite bundles differently than webpack).
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Coloured circular marker with an emoji glyph.
const MARKER_GLYPH: Record<NonNullable<CustomMarker["icon"]>, string> = {
  pin: "📍",
  start: "🚩",
  finish: "🏁",
  aid: "🩹",
  warning: "⚠️",
  photo: "📷",
  food: "🍎",
  water: "💧",
};

function customIcon(color: string, icon: CustomMarker["icon"]) {
  const glyph = MARKER_GLYPH[icon ?? "pin"];
  return L.divIcon({
    className: "rce-custom-marker",
    html: `<div style="background:${color};" class="flex h-8 w-8 items-center justify-center rounded-full text-base ring-2 ring-white shadow-lg">${glyph}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}


const TIER_COLORS: Record<string, string> = {
  Gold: "#d4a017",
  Silver: "#64748b",
  Bronze: "#a0522d",
  Custom: "#e11d48",
};

type Loaded = {
  route: EventRoute;
  dayLabel: string;
  color: string;
  lines: LatLngAlt[][];
  points: { name: string | null; description: string | null; coord: LatLngAlt }[];
  distanceKm: number;
  gainFromKmlM: number | null;
};

type Props = {
  event: Event;
  height?: string;
  showToggles?: boolean;
  showStats?: boolean;
};

function FitToBounds({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [24, 24] });
  }, [bounds, map]);
  return null;
}

export default function RouteMapInner({
  event,
  height = "360px",
  showToggles = true,
  showStats = true,
}: Props) {
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [gainByRoute, setGainByRoute] = useState<Record<string, number | null>>({});
  const fetchElev = useServerFn(getRouteElevation);
  const elevationRequested = useRef(new Set<string>());

  // Collect all routes with KMLs across days.
  const routes = useMemo(() => {
    const out: { route: EventRoute; dayLabel: string }[] = [];
    for (const day of event.days ?? []) {
      const dayLabel = day.label || new Date(day.date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
      for (const r of day.routes ?? []) {
        if ((r.kmlUrls ?? []).length > 0) out.push({ route: r, dayLabel });
      }
    }
    return out;
  }, [event]);

  // Fetch + parse all KMLs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results: Loaded[] = [];
      for (const { route, dayLabel } of routes) {
        const lines: LatLngAlt[][] = [];
        const points: Loaded["points"] = [];
        for (const url of route.kmlUrls ?? []) {
          try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const text = await res.text();
            const layer = parseKml(text);
            for (const line of layer.lines) lines.push(line);
            for (const pt of layer.points) points.push(pt);
          } catch (err) {
            console.warn("[route-map] failed to load", url, err);
          }
        }
        // Distance/elevation come from the ORIGINAL points so stats stay accurate.
        const distanceKm = lines.reduce((acc, l) => acc + polylineKm(l), 0);
        const gainFromKmlM = lines.length
          ? lines.reduce<number | null>((acc, l) => {
              const g = polylineElevationGainM(l);
              if (g === null) return acc;
              return (acc ?? 0) + g;
            }, null)
          : null;

        // For rendering, simplify each line so Leaflet doesn't stall on huge tracks.
        // Tolerance ~6m keeps route shape visually identical; hard cap prevents pathological inputs.
        const simplifiedLines = lines
          .map((l) => simplifyPolyline(l, 6))
          .map((l) => capPolyline(l, 2000));

        if (simplifiedLines.length || points.length) {
          results.push({
            route,
            dayLabel,
            color: route.color || TIER_COLORS[route.tier] || TIER_COLORS.Custom,
            lines: simplifiedLines,
            // Cap markers too — 500 pins is already a lot to click through.
            points: points.slice(0, 500),
            distanceKm,
            gainFromKmlM,
          });
        }
      }
      if (cancelled) return;
      setLoaded(results);
      setEnabled(Object.fromEntries(results.map((r) => [r.route.id, true])));
    })();
    return () => {
      cancelled = true;
    };
  }, [routes]);


  // For routes without KML altitude, fetch elevation from Google.
  useEffect(() => {
    for (const l of loaded) {
      if (l.gainFromKmlM !== null) {
        setGainByRoute((g) => ({ ...g, [l.route.id]: l.gainFromKmlM }));
        continue;
      }
      if (elevationRequested.current.has(l.route.id)) continue;
      elevationRequested.current.add(l.route.id);
      const merged = l.lines.flat();
      if (merged.length < 2) continue;
      const sample = samplePolyline(merged, 200);
      const coords = sample.map(([lng, lat]) => [lng, lat] as [number, number]);
      fetchElev({ data: { coords } })
        .then((res) => {
          if (res.available) {
            setGainByRoute((g) => ({ ...g, [l.route.id]: res.totalGainM }));
          } else {
            setGainByRoute((g) => ({ ...g, [l.route.id]: null }));
          }
        })
        .catch(() => setGainByRoute((g) => ({ ...g, [l.route.id]: null })));
    }
  }, [loaded, fetchElev]);

  const visible = loaded.filter((l) => enabled[l.route.id]);
  const allCoords = visible.flatMap((l) => l.lines.flat());
  const bounds = boundsFromCoords(allCoords);

  const totalDistance = visible.reduce((acc, l) => acc + l.distanceKm, 0);
  const totalGain = visible.reduce((acc, l) => {
    const g = gainByRoute[l.route.id];
    return acc + (g ?? 0);
  }, 0);
  const anyGainKnown = visible.some((l) => gainByRoute[l.route.id] !== undefined && gainByRoute[l.route.id] !== null);

  if (routes.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/40 text-sm text-ink-soft"
        style={{ height }}
      >
        No route maps uploaded for this event yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showToggles && loaded.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {loaded.map((l) => {
            const on = enabled[l.route.id];
            return (
              <button
                key={l.route.id}
                type="button"
                onClick={() => setEnabled((e) => ({ ...e, [l.route.id]: !on }))}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  on
                    ? "border-transparent text-white shadow-sm"
                    : "border-border bg-card text-ink-soft"
                }`}
                style={on ? { backgroundColor: l.color } : undefined}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: l.color }}
                />
                {l.route.name || l.route.tier}
                <span className="opacity-70">· {l.dayLabel}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl ring-1 ring-border">
        <MapContainer
          key={loaded.map((l) => l.route.id).join(",")}
          center={bounds ? undefined : [-33.9249, 18.4241]}
          zoom={bounds ? undefined : 9}
          style={{ height, width: "100%" }}
          scrollWheelZoom
          preferCanvas
        >
          <TileLayer
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitToBounds bounds={bounds} />
          {visible.map((l) =>
            l.lines.map((line, i) => (
              <Polyline
                key={`${l.route.id}-line-${i}`}
                positions={line.map(([lng, lat]) => [lat, lng]) as [number, number][]}
                pathOptions={{ color: l.color, weight: 5, opacity: 0.9 }}
              />
            )),
          )}
          {visible.flatMap((l) =>
            l.points.map((pt, i) => (
              <Marker
                key={`${l.route.id}-pt-${i}`}
                position={[pt.coord[1], pt.coord[0]] as [number, number]}
              >
                <Popup>
                  <div className="max-w-[220px] space-y-1">
                    {pt.name && <p className="font-semibold text-ink">{pt.name}</p>}
                    {pt.description && (
                      <p
                        className="text-xs text-ink-soft"
                        // Descriptions in KML can be plain text or HTML.
                        dangerouslySetInnerHTML={{ __html: pt.description }}
                      />
                    )}
                    <p className="text-[10px] uppercase tracking-wider text-ink-soft/70">
                      {l.route.name || l.route.tier}
                    </p>
                  </div>
                </Popup>
              </Marker>
            )),
          )}
        </MapContainer>
      </div>

      {showStats && visible.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Total distance" value={`${totalDistance.toFixed(1)} km`} />
          <Stat
            label="Elevation gain"
            value={anyGainKnown ? `${totalGain.toLocaleString()} m` : "—"}
            hint={anyGainKnown ? undefined : "Loading…"}
          />
          <Stat label="Routes shown" value={`${visible.length} of ${loaded.length}`} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-border">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="font-display text-lg font-bold text-ink">{value}</p>
      {hint && <p className="text-[10px] text-ink-soft">{hint}</p>}
    </div>
  );
}
