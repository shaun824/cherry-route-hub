// Interactive route map. Client-only — lazy-loaded so Leaflet never runs during
// SSR. Given an event, fetches every KML referenced by its routes, parses them,
// renders coloured polylines, and shows total distance + total elevation gain
// (from KML altitude when available, otherwise Google Elevation API through the
// Lovable connector). Waypoints are NOT parsed from KML — only admin-added
// custom markers are rendered on top of the routes.
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import { RouteProfile } from "@/components/route-profile";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useServerFn } from "@tanstack/react-start";
import { LocateFixed, Maximize2, Minus, Plus, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import type { CustomMarker, Event, EventRoute } from "@/lib/mock-data";
import {
  boundsFromCoords,
  haversineMeters,
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
import { useRouteHover } from "@/lib/route-hover";

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

/** Sponsor logos grow to full size once riders zoom in close. */
const LOGO_MIN_ZOOM = 15;

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const h = () => onZoom(map.getZoom());
    h();
    map.on("zoomend", h);
    return () => {
      map.off("zoomend", h);
    };
  }, [map, onZoom]);
  return null;
}

function customIcon(color: string, icon: CustomMarker["icon"], logoUrl?: string, zoom = 99) {
  if (logoUrl) {
    // Sponsor logos are mostly wide lock-ups, so use a wide rounded plate
    // instead of a circle — a circle shrinks wordmarks until they're unreadable.
    // NOTE: Leaflet's stylesheet forces `.leaflet-marker-pane img { max-width: none !important }`,
    // so the image MUST be sized with explicit width/height, not max-width.
    // Logos are always on, but scale with zoom so they never bury the route.
    const W = zoom >= LOGO_MIN_ZOOM ? 84 : zoom >= 13 ? 64 : 52;
    const H = zoom >= LOGO_MIN_ZOOM ? 34 : zoom >= 13 ? 26 : 22;
    return L.divIcon({
      className: "rce-custom-marker",
      html: `<div style="border-color:${color};width:${W}px;height:${H}px;" class="flex items-center justify-center overflow-hidden rounded-xl border-2 bg-white px-1.5 py-1 shadow-lg"><img src="${logoUrl}" alt="" style="width:100%;height:100%;object-fit:contain;display:block;" /></div>`,
      iconSize: [W, H],
      iconAnchor: [W / 2, H / 2],
      popupAnchor: [0, -H / 2],
    });
  }

  const glyph = MARKER_GLYPH[icon ?? "pin"];
  return L.divIcon({
    className: "rce-custom-marker",
    html: `<div style="background:${color};" class="flex h-7 w-7 items-center justify-center rounded-full text-sm ring-2 ring-white shadow-md">${glyph}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
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
  immersive?: boolean;
  /** Only render routes belonging to these day ids (undefined = all days). */
  dayIds?: string[];
};

function MapControls({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap();
  const controlRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = controlRef.current;
    if (!node) return;
    L.DomEvent.disableClickPropagation(node);
    L.DomEvent.disableScrollPropagation(node);
  }, []);

  return (
    <div ref={controlRef} className="leaflet-top leaflet-right !m-3">
      <div className="leaflet-control flex flex-col gap-2 !border-0 !bg-transparent !shadow-none">
        <Button type="button" size="icon" variant="secondary" className="h-11 w-11 shadow-lg" onClick={() => map.zoomIn(0.5)} aria-label="Zoom in">
          <Plus className="h-5 w-5" />
        </Button>
        <Button type="button" size="icon" variant="secondary" className="h-11 w-11 shadow-lg" onClick={() => map.zoomOut(0.5)} aria-label="Zoom out">
          <Minus className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-11 w-11 shadow-lg"
          onClick={() => bounds && map.fitBounds(bounds, { padding: [28, 28], animate: true, duration: 0.6 })}
          aria-label="Show the full route"
          disabled={!bounds}
        >
          <LocateFixed className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

/** Shows where the rider is on the elevation profile, as a direction arrow,
 *  and keeps the map following from a comfortable distance. */
function HoverMarker() {
  const hover = useRouteHover();
  const map = useMap();
  const scrubbing = useRef(false);
  useEffect(() => {
    if (!hover) {
      scrubbing.current = false;
      return;
    }
    const ll = L.latLng(hover.lat, hover.lng);
    const FOLLOW_ZOOM = 14;
    if (!scrubbing.current) {
      scrubbing.current = true;
      // Zoom in only to a mid-level so riders keep context around them.
      if (map.getZoom() < FOLLOW_ZOOM - 1) {
        map.setView(ll, FOLLOW_ZOOM, { animate: true });
        return;
      }
    }
    // Only pan once the point leaves the middle of the map — a calm follow.
    if (!map.getBounds().pad(-0.3).contains(ll)) map.panTo(ll, { animate: true, duration: 0.35 });
  }, [hover, map]);
  if (!hover) return null;
  const rot = hover.bearing ?? 0;
  return (
    <Marker
      position={[hover.lat, hover.lng] as [number, number]}
      interactive={false}
      zIndexOffset={1000}
      icon={L.divIcon({
        className: "rce-hover-marker",
        html: hover.bearing === undefined
          ? `<div style="width:22px;height:22px;border-radius:9999px;background:#e11d48;border:3px solid #fff;box-shadow:0 0 0 3px rgba(225,29,72,.35);"></div>`
          : `<div style="width:34px;height:34px;display:grid;place-items:center;border-radius:9999px;background:#e11d48;border:3px solid #fff;box-shadow:0 0 0 4px rgba(225,29,72,.3),0 2px 6px rgba(0,0,0,.35);transform:rotate(${rot}deg)"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2 L20 20 L12 15 L4 20 Z" fill="#fff"/></svg></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      })}
    />
  );
}

/** Animated chevrons that flow along each route in its riding direction. */
function DirectionArrows({ lines }: { lines: { color: string; coords: [number, number][] }[] }) {
  const map = useMap();
  useEffect(() => {
    const layer = L.layerGroup().addTo(map);
    type Track = { cum: number[]; pts: L.LatLng[]; total: number; markers: { m: L.Marker; el?: HTMLElement }[] };
    const tracks: Track[] = [];
    for (const l of lines) {
      if (l.coords.length < 2) continue;
      const pts = l.coords.map(([lat, lng]) => L.latLng(lat, lng));
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i - 1].distanceTo(pts[i]));
      const total = cum[cum.length - 1];
      if (total < 50) continue;
      const n = Math.max(2, Math.min(12, Math.round(total / 3500)));
      const markers = Array.from({ length: n }, () => {
        const m = L.marker(pts[0], {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "",
            iconSize: [14, 14],
            iconAnchor: [7, 7],
            html: `<div data-arrow style="width:14px;height:14px;opacity:.9;display:grid;place-items:center;border-radius:9999px;background:${l.color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"><svg width="8" height="8" viewBox="0 0 24 24"><path d="M12 3 L21 19 L12 14 L3 19 Z" fill="#fff"/></svg></div>`,
          }),
        }).addTo(layer);
        return { m };
      });
      tracks.push({ cum, pts, total, markers });
    }
    const at = (t: Track, d: number) => {
      let lo = 0, hi = t.cum.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (t.cum[mid] <= d) lo = mid; else hi = mid;
      }
      const a = t.pts[lo], b = t.pts[hi];
      const seg = t.cum[hi] - t.cum[lo] || 1;
      const f = (d - t.cum[lo]) / seg;
      const pa = map.project(a), pb = map.project(b);
      const ang = (Math.atan2(pb.x - pa.x, pa.y - pb.y) * 180) / Math.PI;
      return { ll: L.latLng(a.lat + (b.lat - a.lat) * f, a.lng + (b.lng - a.lng) * f), ang };
    };
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, last = 0;
    const start = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 60) return;
      last = now;
      const phase = reduce ? 0 : ((now - start) / 6000) % 1; // one gap travelled every 6 s
      for (const t of tracks) {
        const gap = t.total / t.markers.length;
        t.markers.forEach((mk, i) => {
          const { ll, ang } = at(t, ((i + phase) * gap) % t.total);
          mk.m.setLatLng(ll);
          mk.el ??= (mk.m.getElement()?.querySelector("[data-arrow]") as HTMLElement | null) ?? undefined;
          if (mk.el) mk.el.style.transform = `rotate(${ang}deg)`;
        });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      layer.remove();
    };
  }, [lines, map]);
  return null;
}

function FitToBounds({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap();
  // Only fit when the actual bounds values change — the array identity changes
  // on every render, and re-fitting would yank the rider back out of a zoom.
  const key = bounds ? bounds.flat().map((n) => n.toFixed(5)).join(",") : "";
  const applied = useRef<string>("");
  useEffect(() => {
    if (!bounds || !key || applied.current === key) return;
    applied.current = key;
    map.fitBounds(bounds, { padding: [24, 24] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

/**
 * Nearest point on a route to a marker: how far into the route it sits (km)
 * and how far off the line it is (m), so we can hide irrelevant matches.
 */
function distanceAlongRoute(
  lines: LatLngAlt[][],
  lat: number,
  lng: number,
): { km: number; offM: number } | null {
  let best: { km: number; offM: number } | null = null;
  let travelled = 0;
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      if (i > 0) travelled += haversineMeters(line[i - 1], line[i]);
      const off = haversineMeters([lng, lat], line[i]);
      if (!best || off < best.offM) best = { km: travelled / 1000, offM: off };
    }
  }
  return best;
}


export default function RouteMapInner({
  event,
  height = "360px",
  showToggles = true,
  showStats = true,
  immersive = false,
  dayIds,
}: Props) {
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [fs, setFs] = useState(false);
  const [zoom, setZoom] = useState(12);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; n: number } | null>(null);
  const openFs = () => {
    setFs(true);
    try {
      window.history.pushState({ rmFs: true }, "");
    } catch {
      /* ignore */
    }
  };
  const closeFs = () => {
    if (window.history.state?.rmFs) window.history.back();
    else setFs(false);
  };
  useEffect(() => {
    if (!fs) return;
    const onPop = () => setFs(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeFs();
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fs]);
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
      // Start on just the first route — all of them at once is too busy.
      setEnabled(Object.fromEntries(results.map((r, i) => [r.route.id, i === 0])));
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

  // For every custom marker (water points, aid stations…), work out how far
  // into each route of that same day it sits. Only routes that actually pass
  // within 300 m of the marker are listed.
  const markerLegs = useMemo(() => {
    const out: Record<
      string,
      { routeId: string; name: string; color: string; km: number; totalKm: number; remainingKm: number }[]
    > = {};
    for (const owner of loaded) {
      for (const m of owner.markers) {
        const legs: {
          routeId: string;
          name: string;
          color: string;
          km: number;
          totalKm: number;
          remainingKm: number;
        }[] = [];
        for (const l of loaded) {
          if (l.dayLabel !== owner.dayLabel || l.lines.length === 0) continue;
          const hit = distanceAlongRoute(l.lines, m.lat, m.lng);
          if (!hit || hit.offM > 300) continue;
          legs.push({
            routeId: l.route.id,
            name: l.route.name || l.route.tier,
            color: l.color,
            km: hit.km,
            totalKm: l.distanceKm,
            remainingKm: Math.max(0, l.distanceKm - hit.km),
          });
        }
        legs.sort((a, b) => a.km - b.km);
        out[`${owner.route.id}-${m.id}`] = legs;
      }
    }
    return out;
  }, [loaded]);


  const visible = loaded.filter((l) => enabled[l.route.id]);
  const arrowLines = useMemo(
    () =>
      visible.flatMap((l) =>
        l.lines.map((line) => ({ color: l.color, coords: line.map(([lng, lat]) => [lat, lng] as [number, number]) })),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible.map((l) => l.route.id).join(","), loaded],
  );

  // Water points and other markers are usually captured against one route
  // (often Gold), but they serve every distance riding that day — so show them
  // whenever any route from the same day is switched on. Dedupe by position.
  const visibleDays = new Set(visible.map((l) => l.dayLabel));
  const seenMarkers = new Set<string>();
  const shownMarkers: { owner: Loaded; marker: CustomMarker }[] = [];
  for (const owner of loaded) {
    if (!visibleDays.has(owner.dayLabel)) continue;
    for (const m of owner.markers) {
      const key = `${owner.dayLabel}|${m.name}|${m.lat.toFixed(5)}|${m.lng.toFixed(5)}`;
      if (seenMarkers.has(key)) continue;
      seenMarkers.add(key);
      shownMarkers.push({ owner, marker: m });
    }
  }

  const allCoords: LatLngAlt[] = [
    ...visible.flatMap((l) => l.lines.flat()),
    ...shownMarkers.map(({ marker }) => [marker.lng, marker.lat, undefined] as LatLngAlt),
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

  const dayLabels = [...new Set(loaded.map((l) => l.dayLabel))];
  const [chipDay, setChipDay] = useState<string | null>(null);
  // Picking a day shows just that day's route buttons and turns on its first route.
  const showOnlyDay = (day: string | null) => {
    setChipDay(day);
    if (day === null) {
      setEnabled(Object.fromEntries(loaded.map((l) => [l.route.id, true])));
      return;
    }
    const firstId = loaded.find((l) => l.dayLabel === day)?.route.id;
    setEnabled(Object.fromEntries(loaded.map((l) => [l.route.id, l.route.id === firstId])));
  };
  const activeDay =
    visible.length > 0 && visible.every((l) => l.dayLabel === visible[0].dayLabel) &&
    visible.length === loaded.filter((l) => l.dayLabel === visible[0].dayLabel).length &&
    dayLabels.length > 1
      ? visible[0].dayLabel
      : visible.length === loaded.length
        ? "all"
        : null;
  const pointOrder: Record<string, number> = { water: 0, aid: 1, food: 2, start: 3, finish: 4 };
  const listMarkers = [...shownMarkers].sort(
    (a, b) =>
      (pointOrder[a.marker.icon ?? ""] ?? 9) - (pointOrder[b.marker.icon ?? ""] ?? 9) ||
      a.owner.dayLabel.localeCompare(b.owner.dayLabel) ||
      ((markerLegs[`${a.owner.route.id}-${a.marker.id}`]?.[0]?.km ?? 0) -
        (markerLegs[`${b.owner.route.id}-${b.marker.id}`]?.[0]?.km ?? 0)),
  );

  const routeChips = (dark: boolean) =>
    loaded.length > 1 ? (
      <div className="flex gap-2 overflow-x-auto pb-1">
        {loaded.filter((l) => !chipDay || l.dayLabel === chipDay).map((l) => {
          const on = enabled[l.route.id];
          return (
            <button
              key={l.route.id}
              type="button"
              onClick={() => setEnabled((e) => ({ ...e, [l.route.id]: !on }))}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                on ? "border-transparent text-white shadow-sm" : dark ? "border-border bg-background text-ink-soft" : "border-border bg-card text-ink-soft"
              }`}
              style={on ? { backgroundColor: l.color } : undefined}
            >
              <span className="inline-block h-2 w-2 rounded-full ring-1 ring-white/70" style={{ backgroundColor: l.color }} />
              {l.route.name || l.route.tier}
              {dayLabels.length > 1 && !(l.route.name ?? "").includes(l.dayLabel) ? (
                <span className="opacity-70">· {l.dayLabel}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    ) : null;

  const renderMap = (h: string, keySuffix: string) => (
    <MapContainer
      key={loaded.map((l) => l.route.id).join(",") + keySuffix}
      center={bounds ? undefined : [-33.9249, 18.4241]}
      zoom={bounds ? undefined : 9}
      style={{ height: h, width: "100%" }}
      zoomControl={false}
      scrollWheelZoom
      zoomSnap={0}
      zoomDelta={0.5}
      wheelPxPerZoomLevel={180}
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
      <ZoomWatcher onZoom={setZoom} />
      <MapControls bounds={bounds} />
      <HoverMarker />
      <DirectionArrows lines={arrowLines} />
      {keySuffix === "-fs" ? <FlyTo target={flyTarget} /> : null}
      {visible.map((l) =>
        l.lines.map((line, i) => (
          <Polyline
            key={`${l.route.id}-line-${i}`}
            positions={line.map(([lng, lat]) => [lat, lng]) as [number, number][]}
            pathOptions={{ color: l.color, weight: 5, opacity: 0.9 }}
          />
        )),
      )}
      {shownMarkers.map(({ owner: l, marker: m }) => {
        const color = m.color || l.color;
        const legs = (markerLegs[`${l.route.id}-${m.id}`] ?? []).filter((leg) => enabled[leg.routeId]);
        return (
          <Marker
            key={`${l.route.id}-mk-${m.id}`}
            position={[m.lat, m.lng] as [number, number]}
            icon={customIcon(color, m.icon, m.logoUrl, zoom)}
          >
            {m.name ? (
              <Tooltip permanent direction="bottom" offset={[0, m.logoUrl ? (zoom >= LOGO_MIN_ZOOM ? 17 : 12) : 13]} className={`rce-marker-label${zoom < 14 ? " rce-marker-label-sm" : ""}`}>
                {m.name}
              </Tooltip>
            ) : null}
            <Popup>
              <div className="max-w-[260px] space-y-2">
                <div className="flex items-start gap-2">
                  <span
                    className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm"
                    style={{ backgroundColor: color }}
                  >
                    {MARKER_GLYPH[m.icon ?? "pin"]}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{m.name}</p>
                    <p className="text-[10px] uppercase tracking-wider text-ink-soft/70">{l.dayLabel}</p>
                  </div>
                </div>
                {m.description ? <p className="whitespace-pre-line text-xs text-ink-soft">{m.description}</p> : null}
                {legs.length > 0 ? (
                  <div className="space-y-1 rounded-lg bg-secondary/60 p-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">How far into each route</p>
                    {legs.map((leg) => (
                      <div key={leg.routeId} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: leg.color }} />
                          <span className="truncate text-ink">{leg.name}</span>
                        </span>
                        <span className="shrink-0 font-semibold text-ink">
                          {leg.km.toFixed(1)} km
                          <span className="font-normal text-ink-soft"> / {leg.totalKm.toFixed(0)} km</span>
                        </span>
                      </div>
                    ))}
                    {legs.some((leg) => leg.remainingKm > 0) && (
                      <p className="text-[10px] text-ink-soft">
                        {legs.length === 1
                          ? `${legs[0].remainingKm.toFixed(1)} km still to ride after this point.`
                          : "Distances are measured from each route's start."}
                      </p>
                    )}
                  </div>
                ) : null}
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
      })}
    </MapContainer>
  );

  const fullscreenView = fs
    ? createPortal(
        <div className="fixed inset-0 z-[1000] flex flex-col bg-background">
          <div className="space-y-2 border-b border-border bg-card px-3 pb-2 pt-[max(0.6rem,env(safe-area-inset-top))]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeFs}
                aria-label="Close full screen"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-ink"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">Route map</p>
                <p className="truncate font-display text-sm font-bold text-ink">{event.name}</p>
              </div>
              <p className="shrink-0 text-xs font-semibold text-ink-soft">
                {totalDistance.toFixed(1)} km · {visible.length}/{loaded.length} routes
              </p>
            </div>
            {dayLabels.length > 1 ? (
              <div className="flex gap-1.5 overflow-x-auto">
                {[["all", "All days"] as const, ...dayLabels.map((d) => [d, d] as const)].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => showOnlyDay(k === "all" ? null : k)}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ${
                      activeDay === k ? "bg-cherry text-white ring-cherry" : "bg-background text-ink ring-border"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            {routeChips(true)}
          </div>
          <div className="relative min-h-0 flex-1">{renderMap("100%", "-fs")}</div>
          {visible[0] ? (
            <div className="border-t border-border bg-card px-3 pb-1">
              <RouteProfile route={visible[0].route} color={visible[0].color} markers={visible[0].markers} />
            </div>
          ) : null}
          <div
            className={`flex flex-col border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,.12)] ${
              sheetOpen ? "h-[28dvh]" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => setSheetOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="font-display text-sm font-bold text-ink">
                💧 Waterpoints &amp; stops ({listMarkers.length})
              </span>
              <span className="text-xs font-semibold text-cherry">{sheetOpen ? "Hide" : "Show list"}</span>
            </button>
            {sheetOpen ? (
              <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-3">
                {listMarkers.length === 0 ? (
                  <li className="py-6 text-center text-xs text-ink-soft">Switch on a route to see its stops.</li>
                ) : null}
                {listMarkers.map(({ owner, marker: m }) => {
                  const legs = (markerLegs[`${owner.route.id}-${m.id}`] ?? []).filter((leg) => enabled[leg.routeId]);
                  return (
                    <li key={`${owner.route.id}-${m.id}`} className="flex items-center gap-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setFlyTarget({ lat: m.lat, lng: m.lng, n: Date.now() })}
                        className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
                      >
                        <span
                          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm"
                          style={{ backgroundColor: m.color || owner.color }}
                        >
                          {MARKER_GLYPH[m.icon ?? "pin"]}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">{m.name}</span>
                          <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-ink-soft">
                            {dayLabels.length > 1 ? <span>{owner.dayLabel}</span> : null}
                            {legs.map((leg) => (
                              <span key={leg.routeId} className="inline-flex items-center gap-1">
                                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: leg.color }} />
                                {leg.km.toFixed(1)} km
                              </span>
                            ))}
                          </span>
                        </span>
                      </button>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold text-white"
                      >
                        Navigate
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={fill ? "flex h-full flex-col gap-3 p-3" : immersive ? "space-y-3 bg-pe-plett-deep p-3" : "space-y-3"}>
      {showToggles && routeChips(false)}

      <div
        className={`relative overflow-hidden rounded-2xl ring-1 ${immersive ? "ring-pe-plett-accent/30" : "ring-border"} ${fill ? "min-h-0 flex-1" : ""}`}
      >
        {fs ? <div style={{ height }} className="bg-secondary/40" /> : renderMap(height, "")}
        <button
          type="button"
          onClick={openFs}
          className="absolute left-3 top-3 z-[500] inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-2 text-xs font-bold text-ink shadow-lg ring-1 ring-border"
        >
          <Maximize2 className="h-3.5 w-3.5" /> Full screen
        </button>
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
      {fullscreenView}
    </div>
  );
}

function FlyTo({ target }: { target: { lat: number; lng: number; n: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [target, map]);
  return null;
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
