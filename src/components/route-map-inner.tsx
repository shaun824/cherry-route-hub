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
import { withRegistrationDayLabels } from "@/lib/event-days";

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

function customIcon(color: string, icon: CustomMarker["icon"], logoUrl?: string) {
  if (logoUrl) {
    // Sponsor logos are mostly wide lock-ups, so use a wide rounded plate
    // instead of a circle — a circle shrinks wordmarks until they're unreadable.
    return L.divIcon({
      className: "rce-custom-marker",
      html: `<div style="border-color:${color};" class="flex h-9 w-[74px] items-center justify-center overflow-hidden rounded-lg border-2 bg-white px-1 shadow-lg"><img src="${logoUrl}" alt="" style="max-width:100%;max-height:100%;object-fit:contain;" /></div>`,
      iconSize: [74, 36],
      iconAnchor: [37, 18],
      popupAnchor: [0, -18],
    });
  }
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
  markers: CustomMarker[];
  distanceKm: number;
  gainFromKmlM: number | null;
};

type Props = {
  event: Event;
  height?: string;
  showToggles?: boolean;
  showStats?: boolean;
  /** Only render routes belonging to these day ids (undefined = all days). */
  dayIds?: string[];
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
  dayIds,
}: Props) {
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [gainByRoute, setGainByRoute] = useState<Record<string, number | null>>({});
  const fetchElev = useServerFn(getRouteElevation);
  const elevationRequested = useRef(new Set<string>());

  const dayKey = dayIds ? dayIds.join(",") : "";

  // Collect all routes across days that have either KMLs or custom markers.
  const routes = useMemo(() => {
    const only = dayKey ? new Set(dayKey.split(",")) : null;
    const out: { route: EventRoute; dayLabel: string }[] = [];
    for (const day of withRegistrationDayLabels(event.days ?? [], (event.schedule as any) ?? [])) {
      if (only && !only.has(day.id)) continue;
      const dayLabel = day.label || new Date(day.date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
      for (const r of day.routes ?? []) {
        const hasKml = (r.kmlUrls ?? []).length > 0;
        const hasMarkers = (r.customMarkers ?? []).length > 0;
        if (hasKml || hasMarkers) out.push({ route: r, dayLabel });
      }
    }
    return out;
  }, [event, dayKey]);


  // Fetch + parse all KMLs. Waypoints in the KML are intentionally ignored —
  // only admin-defined custom markers are rendered.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results: Loaded[] = [];
      for (const { route, dayLabel } of routes) {
        const lines: LatLngAlt[][] = [];
        for (const url of route.kmlUrls ?? []) {
          try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const text = await res.text();
            const layer = parseKml(text);
            for (const line of layer.lines) lines.push(line);
            // layer.points intentionally discarded — KML waypoints are noise.
          } catch (err) {
            console.warn("[route-map] failed to load", url, err);
          }
        }
        const distanceKm = lines.reduce((acc, l) => acc + polylineKm(l), 0);
        const gainFromKmlM = lines.length
          ? lines.reduce<number | null>((acc, l) => {
              const g = polylineElevationGainM(l);
              if (g === null) return acc;
              return (acc ?? 0) + g;
            }, null)
          : null;

        const simplifiedLines = lines
          .map((l) => simplifyPolyline(l, 6))
          .map((l) => capPolyline(l, 2000));

        const markers = route.customMarkers ?? [];

        if (simplifiedLines.length || markers.length) {
          results.push({
            route,
            dayLabel,
            color: route.color || TIER_COLORS[route.tier] || TIER_COLORS.Custom,
            lines: simplifiedLines,
            markers,
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
  const allCoords: LatLngAlt[] = [
    ...visible.flatMap((l) => l.lines.flat()),
    ...visible.flatMap((l) => l.markers.map((m) => [m.lng, m.lat, undefined] as LatLngAlt)),
  ];
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

  // "100%" means fill the parent (fullscreen map page): the map pane grows and
  // the toggles/stats keep their natural height.
  const fill = height === "100%";

  return (
    <div className={fill ? "flex h-full flex-col gap-3 p-3" : "space-y-3"}>

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
          zoomSnap={0}
          zoomDelta={0.35}
          wheelPxPerZoomLevel={220}
          zoomAnimation
          markerZoomAnimation
          bounceAtZoomLimits={false}
          touchZoom
          doubleClickZoom
          maxZoom={24}
          preferCanvas

        >
          <TileLayer
            crossOrigin="anonymous"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            url="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={24}
            maxNativeZoom={19}
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
            l.markers.map((m) => {
              const color = m.color || l.color;
              return (
                <Marker
                  key={`${l.route.id}-mk-${m.id}`}
                  position={[m.lat, m.lng] as [number, number]}
                  icon={customIcon(color, m.icon, m.logoUrl)}
                >
                  <Popup>
                    <div className="max-w-[240px] space-y-1">
                      <p className="font-semibold text-ink">{m.name}</p>
                      {m.description ? (
                        <p className="whitespace-pre-line text-xs text-ink-soft">{m.description}</p>
                      ) : null}
                      <p className="text-[10px] uppercase tracking-wider text-ink-soft/70">
                        {l.route.name || l.route.tier} · {l.dayLabel}
                      </p>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block rounded-md bg-ink px-2 py-1 text-[11px] font-semibold text-white"
                      >
                        Navigate
                      </a>
                    </div>
                  </Popup>
                </Marker>
              );
            }),
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
