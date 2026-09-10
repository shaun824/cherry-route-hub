// Live spectator map: polls for the latest rider positions every 1s and plots
// them on a Leaflet map. Public — uses the same read path as the spectate page.
// The event's KML course is overlaid underneath, picked by cross-referencing the
// riders' entry category / position against the event's routes.
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import { fetchLiveTracking } from "@/lib/tracking.functions";
import { MapPin, Route as RouteIcon } from "lucide-react";
import { useAdminStore } from "@/lib/store";
import { withRegistrationDayLabels } from "@/lib/event-days";
import { parseKml, simplifyPolyline, capPolyline, type LatLngAlt } from "@/lib/geo";
import {
  candidateDayIds,
  matchRoutesForRiders,
  type RouteCandidate,
} from "@/lib/tracking-route-overlay";

const TIER_COLORS: Record<string, string> = {
  Gold: "#d4a017",
  Silver: "#64748b",
  Bronze: "#a0522d",
  Custom: "#e11d48",
};

const POLL_MS = 3_000;
const STALE_AFTER_MS = 5 * 60_000;

function markerIcon(stale: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:18px;height:18px;border-radius:9999px;
      background:${stale ? "#9ca3af" : "#e11d48"};
      border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function formatAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const ago = Math.max(0, Date.now() - d);
  if (ago < 60_000) return "just now";
  if (ago < 60 * 60_000) return `${Math.floor(ago / 60_000)}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function bearingText(lat1: number, lng1: number, lat2: number, lng2: number): string {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1r = (lat1 * Math.PI) / 180;
  const lat2r = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2r);
  const x = Math.cos(lat1r) * Math.sin(lat2r) - Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  const normalized = (brng + 360) % 360;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"];
  return dirs[Math.round(normalized / 45)];
}

function navUrl(lat: number, lng: number): string {
  const isIOS =
    typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) return `maps://?daddr=${lat},${lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

function popupContent(r: {
  riderName: string | null;
  bib: string | null;
  category: string | null;
  lat: number;
  lng: number;
  batteryPct: number | null;
  recordedAt: string;
}, isCrew: boolean, viewer: { lat: number; lng: number } | null): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "min-w-[180px] max-w-[260px] font-sans text-sm";

  const title = document.createElement("p");
  title.className = "font-bold text-ink";
  title.textContent = r.riderName || r.bib || "Rider";
  wrap.appendChild(title);

  const meta = document.createElement("p");
  meta.className = "text-xs text-muted-foreground";
  const bits = [
    r.bib ? `#${r.bib}` : null,
    r.category ?? null,
    formatAgo(r.recordedAt),
  ].filter(Boolean);
  meta.textContent = bits.join(" · ");
  wrap.appendChild(meta);

  if (isCrew) {
    if (r.batteryPct != null) {
      const bat = document.createElement("p");
      bat.className = "mt-1 text-xs text-muted-foreground";
      bat.textContent = `Battery ${r.batteryPct}%`;
      wrap.appendChild(bat);
    }

    if (viewer) {
      const dist = document.createElement("p");
      dist.className = "mt-1 text-xs font-semibold text-cherry";
      const km = haversineKm(viewer.lat, viewer.lng, r.lat, r.lng);
      const dir = bearingText(viewer.lat, viewer.lng, r.lat, r.lng);
      dist.textContent = `${km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(1)} km`} · ${dir}`;
      wrap.appendChild(dist);
    }

    const actions = document.createElement("div");
    actions.className = "mt-2 flex flex-wrap gap-2";

    const navBtn = document.createElement("a");
    navBtn.href = navUrl(r.lat, r.lng);
    navBtn.target = "_blank";
    navBtn.rel = "noopener noreferrer";
    navBtn.className =
      "inline-flex items-center gap-1 rounded-full bg-cherry px-2.5 py-1 text-xs font-semibold text-white no-underline";
    navBtn.textContent = "Navigate";
    actions.appendChild(navBtn);

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className =
      "rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground";
    copyBtn.textContent = "Copy";
    copyBtn.dataset.action = "copy";
    actions.appendChild(copyBtn);

    const shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className =
      "rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground";
    shareBtn.textContent = "Share";
    shareBtn.dataset.action = "share";
    actions.appendChild(shareBtn);

    wrap.appendChild(actions);
  }

  return wrap;
}

export default function LiveTrackingMapInner({
  eventId,
  isCrew = false,
}: {
  eventId: string;
  isCrew?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const fittedRef = useRef(false);
  const [follow, setFollow] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [viewerLoc, setViewerLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const guideLineRef = useRef<L.Polyline | null>(null);

  const { data } = useQuery({
    queryKey: ["live-tracking", eventId],
    queryFn: () => fetchLiveTracking({ data: { eventId } }),
    refetchInterval: POLL_MS,
  });

  const riders = useMemo(() => data?.riders ?? [], [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return riders;
    return riders.filter(
      (r) =>
        (r.riderName ?? "").toLowerCase().includes(q) ||
        (r.bib ?? "").toLowerCase().includes(q),
    );
  }, [riders, search]);

  // Viewer location for crew distance/bearing and guide line.
  useEffect(() => {
    if (!isCrew || typeof navigator === "undefined" || !navigator.geolocation) return;
    let watch: number | undefined;
    navigator.geolocation.getCurrentPosition(
      (p) => setViewerLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
    );
    watch = navigator.geolocation.watchPosition(
      (p) => setViewerLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
    );
    return () => {
      if (watch != null) navigator.geolocation.clearWatch(watch);
    };
  }, [isCrew]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView([-29.5, 24.5], 6);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // ---- Course overlay -------------------------------------------------
  const event = useAdminStore((s) => s.events.find((e) => e.id === eventId));
  const [candidates, setCandidates] = useState<RouteCandidate[]>([]);
  const routeLayersRef = useRef<Map<string, L.Polyline[]>>(new Map());

  // Routes that could apply today (falls back to every day of the event).
  const routeSpecs = useMemo(() => {
    if (!event) return [] as { route: any; dayId: string; dayLabel: string }[];
    const only = candidateDayIds(event);
    const days = withRegistrationDayLabels(event.days ?? [], (event.schedule as any) ?? []);
    const out: { route: any; dayId: string; dayLabel: string }[] = [];
    for (const day of days) {
      if (only && !only.includes(day.id)) continue;
      const dayLabel =
        day.label ||
        new Date(day.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
      for (const r of day.routes ?? []) {
        if ((r.kmlUrls ?? []).length > 0) out.push({ route: r, dayId: day.id, dayLabel });
      }
    }
    return out;
  }, [event]);

  const specKey = routeSpecs.map((s) => s.route.id).join(",");

  // Fetch + parse the KMLs for the candidate routes.
  useEffect(() => {
    let cancelled = false;
    if (routeSpecs.length === 0) {
      setCandidates([]);
      return;
    }
    (async () => {
      const out: RouteCandidate[] = [];
      for (const spec of routeSpecs) {
        const lines: LatLngAlt[][] = [];
        for (const url of spec.route.kmlUrls ?? []) {
          try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const layer = parseKml(await res.text());
            for (const line of layer.lines) {
              lines.push(capPolyline(simplifyPolyline(line, 8), 1500));
            }
          } catch (err) {
            console.warn("[live-map] failed to load KML", url, err);
          }
        }
        if (lines.length === 0) continue;
        out.push({
          route: spec.route,
          dayId: spec.dayId,
          dayLabel: spec.dayLabel,
          color: spec.route.color || TIER_COLORS[spec.route.tier] || TIER_COLORS.Custom,
          lines,
        });
      }
      if (!cancelled) setCandidates(out);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey]);

  // Cross-reference riders against the routes to decide what to highlight.
  const matchedIds = useMemo(
    () => matchRoutesForRiders(candidates, riders.map((r) => ({ lat: r.lat, lng: r.lng, category: r.category }))),
    [candidates, riders],
  );

  const matchedRoutes = useMemo(
    () => candidates.filter((c) => matchedIds.includes(c.route.id)),
    [candidates, matchedIds],
  );

  // Draw the course underneath the rider markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [, polys] of routeLayersRef.current) polys.forEach((p) => p.remove());
    routeLayersRef.current.clear();

    const show = matchedRoutes.length > 0 ? matchedRoutes : candidates;
    const bounds: [number, number][] = [];
    for (const c of show) {
      const active = matchedRoutes.length === 0 || matchedIds.includes(c.route.id);
      const polys = c.lines.map((line) => {
        const latlngs = line.map(([lng, lat]) => [lat, lng] as [number, number]);
        for (const ll of latlngs) bounds.push(ll);
        return L.polyline(latlngs, {
          color: c.color,
          weight: active ? 5 : 3,
          opacity: active ? 0.85 : 0.35,
        })
          .addTo(map)
          .bindTooltip(`${c.route.name} · ${c.dayLabel}`, { sticky: true });
      });
      routeLayersRef.current.set(c.route.id, polys);
      polys.forEach((p) => p.bringToBack());
    }

    if (!fittedRef.current && bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.1));
    }

    return () => {
      for (const [, polys] of routeLayersRef.current) polys.forEach((p) => p.remove());
      routeLayersRef.current.clear();
    };
  }, [candidates, matchedRoutes, matchedIds]);

  // Update markers and popups.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    const now = Date.now();
    const bounds: [number, number][] = [];

    for (const r of riders) {
      seen.add(r.userId);
      const stale = now - new Date(r.recordedAt).getTime() > STALE_AFTER_MS;
      const existing = markersRef.current.get(r.userId);
      if (existing) {
        existing.setLatLng([r.lat, r.lng]);
        existing.setIcon(markerIcon(stale));
        // Refresh popup content if this rider is selected.
        if (selectedId === r.userId) {
          existing.setPopupContent(popupContent(r, isCrew, viewerLoc));
          existing.openPopup();
        }
      } else {
        const m = L.marker([r.lat, r.lng], { icon: markerIcon(stale) })
          .addTo(map)
          .bindPopup(popupContent(r, isCrew, viewerLoc));
        m.on("popupopen", () => {
          setSelectedId(r.userId);
          const el = m.getPopup()?.getElement();
          if (!el) return;
          const copyBtn = el.querySelector('[data-action="copy"]') as HTMLButtonElement | null;
          const shareBtn = el.querySelector('[data-action="share"]') as HTMLButtonElement | null;
          copyBtn?.addEventListener("click", () => {
            const text = `${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}`;
            navigator.clipboard?.writeText(text).catch(() => {});
            copyBtn.textContent = "Copied";
            window.setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
          });
          shareBtn?.addEventListener("click", async () => {
            const text = `Rider ${r.riderName || r.bib || ""} at ${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}`;
            if (navigator.share) {
              try {
                await navigator.share({ title: "Rider location", text });
              } catch {
                // user cancelled
              }
            } else {
              navigator.clipboard?.writeText(text).catch(() => {});
              shareBtn.textContent = "Copied";
              window.setTimeout(() => (shareBtn.textContent = "Share"), 1500);
            }
          });
        });
        m.on("popupclose", () => {
          setSelectedId((id) => (id === r.userId ? null : id));
        });
        markersRef.current.set(r.userId, m);
      }
      bounds.push([r.lat, r.lng]);
      // Keep the map centred on whoever is being followed or whose pin is open,
      // so a selected rider stays in view as they move.
      if (follow === r.userId || selectedId === r.userId) {
        map.panTo([r.lat, r.lng], { animate: true, duration: 0.5 });
      }
    }

    // Remove markers for riders no longer reporting.
    for (const [id, m] of markersRef.current) {
      if (!seen.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    }

    if (!fittedRef.current && bounds.length > 0 && !follow) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.15));
      fittedRef.current = true;
    }
  }, [riders, follow, isCrew, viewerLoc, selectedId]);

  // Draw/refresh the dashed guide line from viewer to selected rider.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (guideLineRef.current) {
      guideLineRef.current.remove();
      guideLineRef.current = null;
    }
    if (!isCrew || !viewerLoc || !selectedId) return;
    const rider = riders.find((r) => r.userId === selectedId);
    if (!rider) return;
    guideLineRef.current = L.polyline(
      [
        [viewerLoc.lat, viewerLoc.lng],
        [rider.lat, rider.lng],
      ],
      { dashArray: "6,8", color: "#e11d48", weight: 2, opacity: 0.7 },
    ).addTo(map);
    return () => {
      if (guideLineRef.current) {
        guideLineRef.current.remove();
        guideLineRef.current = null;
      }
    };
  }, [isCrew, viewerLoc, selectedId, riders]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a rider by name or race number…"
          className="w-full rounded-xl bg-card px-3 py-2 text-sm text-ink ring-1 ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cherry"
        />
      </div>
      {search.trim() ? (
        <div className="flex flex-wrap gap-1.5">
          {filtered.slice(0, 8).map((r) => (
            <button
              key={r.userId}
              type="button"
              onClick={() => {
                setFollow(r.userId);
                const map = mapRef.current;
                if (map) map.setView([r.lat, r.lng], Math.max(map.getZoom(), 14));
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${
                follow === r.userId
                  ? "bg-cherry text-white ring-cherry"
                  : "bg-card text-ink ring-border hover:bg-accent"
              }`}
            >
              {r.riderName ?? "Rider"}
              {r.bib ? ` · #${r.bib}` : ""}
            </button>
          ))}
          {follow ? (
            <button
              type="button"
              onClick={() => setFollow(null)}
              className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
            >
              Stop following
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        ref={containerRef}
        className="h-96 w-full overflow-hidden rounded-2xl ring-1 ring-border"
      />
      {(matchedRoutes.length > 0 ? matchedRoutes : candidates).length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <RouteIcon className="h-3.5 w-3.5 text-cherry" />
          <span>{matchedRoutes.length > 0 ? "Your route" : "Event routes"}:</span>
          {(matchedRoutes.length > 0 ? matchedRoutes : candidates).map((c) => (
            <span key={c.route.id} className="inline-flex items-center gap-1.5 font-medium text-ink">
              <span
                className="inline-block h-2.5 w-6 rounded-full"
                style={{ backgroundColor: c.color }}
              />
              {c.route.name} · {c.dayLabel}
            </span>
          ))}
        </div>
      ) : null}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 text-cherry" />
        {riders.length > 0
          ? `${riders.length} rider${riders.length === 1 ? "" : "s"} tracking · updates every second`
          : "No riders are sharing their position yet — dots appear here once riders start tracking."}
      </p>
    </div>
  );
}
