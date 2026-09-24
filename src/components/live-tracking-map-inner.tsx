// Live spectator map: polls for the latest rider positions and plots them on a
// Leaflet map. Public — uses the same read path as the spectate page.
// The event's KML course is overlaid underneath, picked by cross-referencing the
// riders' entry category / position against the event's routes.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { useQuery } from "@tanstack/react-query";
import { fetchLiveTracking, type LiveRiderPosition } from "@/lib/tracking.functions";
import { Crosshair, MapPin, Route as RouteIcon } from "lucide-react";
import { useAdminStore } from "@/lib/store";
import { withRegistrationDayLabels } from "@/lib/event-days";
import { parseKml, simplifyPolyline, capPolyline, type LatLngAlt } from "@/lib/geo";
import {
  buildCourseLine,
  formatProgress,
  progressOnCourse,
  type CourseLine,
} from "@/lib/course-progress";
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
const LOST_SIGNAL_MS = 10 * 60_000;
// A rider further than this from the course line counts as off course.
const OFF_COURSE_M = 400;

type Signal = "live" | "stale" | "lost";

function signalOf(recordedAt: string): Signal {
  const age = Date.now() - new Date(recordedAt).getTime();
  if (age > LOST_SIGNAL_MS) return "lost";
  if (age > STALE_AFTER_MS) return "stale";
  return "live";
}

function markerIcon(signal: Signal, sos: boolean) {
  if (sos) {
    return L.divIcon({
      className: "",
      html: `<div class="rce-sos-pin" style="
        width:26px;height:26px;border-radius:9999px;background:#dc2626;
        border:3px solid #fff;box-shadow:0 0 0 6px rgba(220,38,38,.35);
        display:flex;align-items:center;justify-content:center;color:#fff;
        font-size:14px;font-weight:900;">!</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }
  const color = signal === "lost" ? "#6b7280" : signal === "stale" ? "#9ca3af" : "#e11d48";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:18px;height:18px;border-radius:9999px;
      background:${color};
      border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4);
      ${signal === "lost" ? "opacity:.75;" : ""}
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

function popupContent(
  r: LiveRiderPosition,
  isCrew: boolean,
  viewer: { lat: number; lng: number } | null,
  progressText: string | null,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "min-w-[180px] max-w-[260px] font-sans text-sm";

  if (r.sos) {
    const sos = document.createElement("p");
    sos.className = "mb-1 rounded bg-red-600 px-2 py-1 text-xs font-black uppercase text-white";
    sos.textContent = `SOS${r.sosReason ? ` · ${r.sosReason}` : ""}`;
    wrap.appendChild(sos);
  }

  const title = document.createElement("p");
  title.className = "font-bold text-ink";
  title.textContent = r.riderName || r.bib || "Rider";
  wrap.appendChild(title);

  const meta = document.createElement("p");
  meta.className = "text-xs text-muted-foreground";
  const age = Date.now() - new Date(r.recordedAt).getTime();
  const bits = [
    r.bib ? `#${r.bib}` : null,
    r.category ?? null,
    age > LOST_SIGNAL_MS
      ? `lost signal · ${formatAgo(r.recordedAt)}`
      : age > STALE_AFTER_MS
        ? `stale · ${formatAgo(r.recordedAt)}`
        : formatAgo(r.recordedAt),
  ].filter(Boolean);
  meta.textContent = bits.join(" · ");
  wrap.appendChild(meta);

  if (progressText) {
    const prog = document.createElement("p");
    prog.className = "mt-1 text-xs font-semibold text-ink";
    prog.textContent = progressText;
    wrap.appendChild(prog);
  }


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

function followKey(eventId: string) {
  return `rce-follow-${eventId}`;
}

export default function LiveTrackingMapInner({
  eventId,
  isCrew = false,
  focusUserId = null,
  onOffCourse,
  riderMode = false,
  onFocusedProgress,
  currentPosition = null,
}: {
  eventId: string;
  isCrew?: boolean;
  /** Race control can jump the map to a specific rider. */
  focusUserId?: string | null;
  /** Reports riders sitting far off the course line (metres), for the watch list. */
  onOffCourse?: (map: Record<string, number>) => void;
  /** Compact, map-first view embedded in the rider's own tracking controls. */
  riderMode?: boolean;
  onFocusedProgress?: (progress: ReturnType<typeof progressOnCourse>) => void;
  currentPosition?: { lat: number; lng: number } | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const circlesRef = useRef<Map<string, L.Circle>>(new Map());
  const animRef = useRef<Map<string, number>>(new Map());
  const fittedRef = useRef(false);
  const programmaticMoveRef = useRef(false);
  const [follow, setFollow] = useState<string | null>(null);
  const [followPaused, setFollowPaused] = useState(false);
  const [search, setSearch] = useState("");
  const [showFinished, setShowFinished] = useState(false);
  const [viewerLoc, setViewerLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const guideLineRef = useRef<L.Polyline | null>(null);
  const ownMarkerRef = useRef<L.Marker | null>(null);

  // Remember who a spectator is following so reopening the page keeps them on
  // their rider instead of making them search again.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(followKey(eventId));
      if (saved) setFollow(saved);
    } catch {
      /* storage unavailable */
    }
  }, [eventId]);

  const startFollowing = useCallback(
    (userId: string | null) => {
      setFollow(userId);
      setFollowPaused(false);
      try {
        if (userId) localStorage.setItem(followKey(eventId), userId);
        else localStorage.removeItem(followKey(eventId));
      } catch {
        /* storage unavailable */
      }
    },
    [eventId],
  );

  useEffect(() => {
    if (focusUserId) startFollowing(focusUserId);
  }, [focusUserId, startFollowing]);

  const { data } = useQuery({
    queryKey: ["live-tracking", eventId],
    queryFn: () => fetchLiveTracking({ data: { eventId } }),
    refetchInterval: POLL_MS,
  });

  const allRiders = useMemo(() => data?.riders ?? [], [data]);
  const finishedCount = allRiders.filter((r) => r.finished).length;
  // Finished riders would otherwise sit on the map as grey clutter all day.
  const riders = useMemo(
    () => (showFinished ? allRiders : allRiders.filter((r) => !r.finished || r.sos)),
    [allRiders, showFinished],
  );
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

    // Cluster ordinary riders so 300 dots stay readable; SOS pins are added to
    // the map directly so they can never be swallowed by a cluster bubble.
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 45,
      iconCreateFunction: (c) => {
        const n = c.getChildCount();
        const size = n < 10 ? 34 : n < 50 ? 42 : n < 150 ? 50 : 58;
        return L.divIcon({
          className: "",
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:9999px;
            background:rgba(30,41,59,.85);color:#fff;border:3px solid #fff;
            display:flex;align-items:center;justify-content:center;
            font-weight:800;font-size:${n < 100 ? 13 : 12}px;
            box-shadow:0 2px 8px rgba(0,0,0,.35);">${n}</div>`,
          iconSize: [size, size],
        });
      },
    });
    cluster.addTo(map);
    clusterRef.current = cluster;

    // Standard follow behaviour: a manual pan or zoom pauses auto-recentring.
    const onUserMove = () => {
      if (programmaticMoveRef.current) return;
      setFollowPaused(true);
    };
    map.on("dragstart", onUserMove);
    map.on("zoomstart", onUserMove);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      markersRef.current.clear();
      circlesRef.current.clear();
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

  // Course line used for progress + off-course checks (the matched route).
  const course: CourseLine | null = useMemo(() => {
    const pick = matchedRoutes[0] ?? candidates[0];
    return pick ? buildCourseLine(pick.lines) : null;
  }, [matchedRoutes, candidates]);

  const progressFor = useCallback(
    (r: LiveRiderPosition) => (course ? progressOnCourse(course, r.lat, r.lng) : null),
    [course],
  );

  const focusedProgress = useMemo(() => {
    if (currentPosition && course) {
      return progressOnCourse(course, currentPosition.lat, currentPosition.lng);
    }
    const focused = focusUserId ? riders.find((r) => r.userId === focusUserId) : null;
    return focused ? progressFor(focused) : null;
  }, [currentPosition, course, focusUserId, riders, progressFor]);

  useEffect(() => {
    onFocusedProgress?.(focusedProgress);
  }, [focusedProgress, onFocusedProgress]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !riderMode || !currentPosition) return;
    if (!ownMarkerRef.current) {
      ownMarkerRef.current = L.marker([currentPosition.lat, currentPosition.lng], {
        icon: markerIcon("live", false),
        zIndexOffset: 900,
      }).addTo(map).bindTooltip("You", { permanent: true, direction: "top", offset: [0, -8] });
    } else {
      ownMarkerRef.current.setLatLng([currentPosition.lat, currentPosition.lng]);
    }
    if (!followPaused) {
      programmaticMoveRef.current = true;
      map.setView([currentPosition.lat, currentPosition.lng], Math.max(map.getZoom(), 15));
      window.setTimeout(() => (programmaticMoveRef.current = false), 700);
    }
  }, [currentPosition, followPaused, riderMode]);

  // Off-course watch list for race control (soft warning — never an alarm).
  useEffect(() => {
    if (!onOffCourse || !course) return;
    const out: Record<string, number> = {};
    for (const r of riders) {
      const p = progressOnCourse(course, r.lat, r.lng);
      if (p && p.offCourseM > OFF_COURSE_M) out[r.userId] = p.offCourseM;
    }
    onOffCourse(out);
  }, [riders, course, onOffCourse]);

  /** Eases a marker from where it is to its new position over the poll window. */
  const animateTo = useCallback((id: string, marker: L.Marker, lat: number, lng: number) => {
    const from = marker.getLatLng();
    if (Math.abs(from.lat - lat) < 1e-7 && Math.abs(from.lng - lng) < 1e-7) return;
    // Big jumps (offline catch-up) snap instead of sliding across the map.
    if (Math.abs(from.lat - lat) > 0.05 || Math.abs(from.lng - lng) > 0.05) {
      marker.setLatLng([lat, lng]);
      return;
    }
    const existing = animRef.current.get(id);
    if (existing) cancelAnimationFrame(existing);
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / POLL_MS);
      const e = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k; // ease in/out
      marker.setLatLng([from.lat + (lat - from.lat) * e, from.lng + (lng - from.lng) * e]);
      if (k < 1) animRef.current.set(id, requestAnimationFrame(step));
      else animRef.current.delete(id);
    };
    animRef.current.set(id, requestAnimationFrame(step));
  }, []);

  // Update markers and popups.
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;
    const seen = new Set<string>();
    const bounds: [number, number][] = [];

    for (const r of riders) {
      seen.add(r.userId);
      const signal = signalOf(r.recordedAt);
      const p = progressFor(r);
      const progressText = p && p.offCourseM < 1000 ? formatProgress(p) : null;
      const existing = markersRef.current.get(r.userId);
      if (existing) {
        animateTo(r.userId, existing, r.lat, r.lng);
        existing.setIcon(markerIcon(signal, r.sos));
        // An SOS pin must live outside the cluster group so it always shows.
        const inCluster = cluster.hasLayer(existing);
        if (r.sos && inCluster) {
          cluster.removeLayer(existing);
          existing.addTo(map);
        } else if (!r.sos && !inCluster) {
          existing.remove();
          cluster.addLayer(existing);
        }
        if (selectedId === r.userId) {
          existing.setPopupContent(popupContent(r, isCrew, viewerLoc, progressText));
          existing.openPopup();
        }
      } else {
        const m = L.marker([r.lat, r.lng], { icon: markerIcon(signal, r.sos) }).bindPopup(
          popupContent(r, isCrew, viewerLoc, progressText),
        );
        if (r.sos) m.addTo(map);
        else cluster.addLayer(m);
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

      // Faint accuracy halo so viewers can tell a sharp fix from a rough one.
      if (r.accuracyM != null && r.accuracyM > 25) {
        const circle = circlesRef.current.get(r.userId);
        if (circle) circle.setLatLng([r.lat, r.lng]).setRadius(r.accuracyM);
        else
          circlesRef.current.set(
            r.userId,
            L.circle([r.lat, r.lng], {
              radius: r.accuracyM,
              color: "#e11d48",
              weight: 1,
              opacity: 0.25,
              fillOpacity: 0.07,
              interactive: false,
            }).addTo(map),
          );
      } else {
        circlesRef.current.get(r.userId)?.remove();
        circlesRef.current.delete(r.userId);
      }

      bounds.push([r.lat, r.lng]);
      // Follow mode recentres smoothly, but stays out of the way once the
      // viewer has panned or zoomed themselves.
      if ((follow === r.userId || selectedId === r.userId) && !followPaused) {
        programmaticMoveRef.current = true;
        map.panTo([r.lat, r.lng], { animate: true, duration: 0.5 });
        window.setTimeout(() => (programmaticMoveRef.current = false), 700);
      }
    }

    // Remove markers for riders no longer reporting.
    for (const [id, m] of markersRef.current) {
      if (!seen.has(id)) {
        const anim = animRef.current.get(id);
        if (anim) cancelAnimationFrame(anim);
        animRef.current.delete(id);
        if (cluster.hasLayer(m)) cluster.removeLayer(m);
        m.remove();
        markersRef.current.delete(id);
        circlesRef.current.get(id)?.remove();
        circlesRef.current.delete(id);
      }
    }

    if (!fittedRef.current && bounds.length > 0 && !follow) {
      programmaticMoveRef.current = true;
      map.fitBounds(L.latLngBounds(bounds).pad(0.15));
      fittedRef.current = true;
      window.setTimeout(() => (programmaticMoveRef.current = false), 700);
    }
  }, [riders, follow, followPaused, isCrew, viewerLoc, selectedId, animateTo, progressFor]);


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
    <div className="relative space-y-2">
      {!riderMode ? <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a rider by name or race number…"
          className="w-full rounded-xl bg-card px-3 py-2 text-sm text-ink ring-1 ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cherry"
        />
      </div> : null}
      {!riderMode && search.trim() ? (
        <div className="flex flex-wrap gap-1.5">
          {filtered.slice(0, 8).map((r) => {
            const p = progressFor(r);
            return (
              <button
                key={r.userId}
                type="button"
                onClick={() => {
                  startFollowing(r.userId);
                  const map = mapRef.current;
                  if (map) {
                    programmaticMoveRef.current = true;
                    map.setView([r.lat, r.lng], Math.max(map.getZoom(), 14));
                    window.setTimeout(() => (programmaticMoveRef.current = false), 700);
                  }
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${
                  follow === r.userId
                    ? "bg-cherry text-white ring-cherry"
                    : "bg-card text-ink ring-border hover:bg-accent"
                }`}
              >
                {r.riderName ?? "Rider"}
                {r.bib ? ` · #${r.bib}` : ""}
                {p && p.offCourseM < 1000 ? ` · ${formatProgress(p)}` : ""}
              </button>
            );
          })}
        </div>
      ) : null}

      {follow ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-card px-3 py-2 text-xs ring-1 ring-border">
          <span className="font-semibold text-ink">
            Following{" "}
            {riders.find((r) => r.userId === follow)?.riderName ?? "this rider"}
            {followPaused ? " · paused while you move the map" : ""}
          </span>
          {followPaused ? (
            <button
              type="button"
              onClick={() => setFollowPaused(false)}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-cherry px-3 py-1 font-bold text-white"
            >
              <Crosshair className="h-3.5 w-3.5" /> Re-centre
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => startFollowing(null)}
            className={`rounded-full bg-secondary px-3 py-1 font-semibold text-secondary-foreground ${followPaused ? "" : "ml-auto"}`}
          >
            Stop following
          </button>
        </div>
      ) : null}

      {riderMode && followPaused ? (
        <button
          type="button"
          onClick={() => setFollowPaused(false)}
          className="absolute right-4 top-24 z-[600] inline-flex items-center gap-1 rounded-full bg-cherry px-3 py-2 text-xs font-bold text-white shadow-lg"
        >
          <Crosshair className="h-3.5 w-3.5" /> Re-centre
        </button>
      ) : null}

      <div
        ref={containerRef}
        className={`${riderMode ? "h-[52dvh] min-h-80" : "h-96"} w-full overflow-hidden rounded-2xl ring-1 ring-border`}
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

      {!riderMode ? <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-cherry" />
          {riders.length > 0
            ? `${riders.length} rider${riders.length === 1 ? "" : "s"} on course · updates every 3 seconds`
            : "No riders are sharing their position yet — dots appear here once riders start tracking."}
        </p>
        {finishedCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowFinished((s) => !s)}
            className="ml-auto rounded-full bg-card px-3 py-1 text-xs font-semibold text-ink ring-1 ring-border"
          >
            {showFinished ? "Hide" : "Show"} finished ({finishedCount})
          </button>
        ) : null}
      </div> : null}

    </div>
  );
}
