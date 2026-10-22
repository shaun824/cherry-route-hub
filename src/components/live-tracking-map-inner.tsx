// Live spectator map: polls for the latest rider positions and plots them on a
// Leaflet map. Public — uses the same read path as the spectate page.
// The event's KML course is overlaid underneath, picked by cross-referencing the
// riders' entry category / position against the event's routes.
import { useHydratedStore } from "@/lib/use-hydrated-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
// Bearing support (heading-up, like Google Maps). UMD plugin patches global L;
// this module is only loaded lazily in the browser.
(globalThis as unknown as { L: typeof L }).L = L;
await import("leaflet-rotate");
import "leaflet.markercluster/dist/MarkerCluster.css";
import { useQuery } from "@tanstack/react-query";
import { fetchLiveTracking, type LiveRiderPosition } from "@/lib/tracking.functions";
import { Compass, Crosshair, Layers, LocateFixed, MapPin, Maximize2, Navigation, Copy, Share2, Check, Route as RouteIcon, Search, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { CustomMarker } from "@/lib/mock-data";
import { RouteProfile } from "@/components/route-profile";
import { useRouteHover } from "@/lib/route-hover";
import {
  fetchTeamLocationsCrew,
  fetchTeamLocationsField,
  shareTeamLocationCrew,
  shareTeamLocationField,
} from "@/lib/crew-field-link.functions";

const SHARE_RADIUS_M = 2000;

const POINT_TYPE: Record<string, { label: string; glyph: string; color: string }> = {
  water: { label: "Waterpoints", glyph: "💧", color: "#0284c7" },
  warning: { label: "Marshals", glyph: "🦺", color: "#f97316" },
  aid: { label: "Medics", glyph: "✚", color: "#dc2626" },
  food: { label: "Food", glyph: "🍌", color: "#16a34a" },
  start: { label: "Start", glyph: "🚩", color: "#334155" },
  finish: { label: "Finish", glyph: "🏁", color: "#334155" },
  photo: { label: "Photo spots", glyph: "📷", color: "#7c3aed" },
  pin: { label: "Other points", glyph: "📍", color: "#334155" },
  sponsor: { label: "Sponsors", glyph: "★", color: "#0ea5e9" },
};

type FieldPoint = { key: string; name: string; lat: number; lng: number; icon: string; routes: string[] };

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function fmtDist(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
import { useAdminStore } from "@/lib/store";
import { withRegistrationDayLabels } from "@/lib/event-days";
import { useIsAdmin } from "@/lib/auth";
import { inRaceLocationWindow } from "@/lib/location-window";
import { addDirectionArrows } from "@/lib/map-direction-arrows";
import { parseKml, simplifyPolyline, capPolyline, type LatLngAlt } from "@/lib/geo";
import {
  buildCourseLine,
  formatProgress,
  progressOnCourse,
  estimateRider,
  type CourseLine,
  type RiderEstimate,
} from "@/lib/course-progress";
import {
  candidateDayIds,
  categoryMatchesRoute,
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

function markerIcon(signal: Signal, sos: boolean, fav = false) {
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
      position:relative;
    ">${fav ? `<span style="position:absolute;top:-12px;left:6px;font-size:12px;color:#f59e0b;text-shadow:0 0 2px #fff;">★</span>` : ""}</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}


function estimatedIcon(capped: boolean, fav = false) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:18px;height:18px;border-radius:9999px;background:rgba(255,255,255,.55);
      border:2px dashed #e11d48;opacity:${capped ? 0.5 : 0.75};position:relative;">
      <span style="position:absolute;top:-9px;left:12px;padding:0 3px;border-radius:4px;background:#fff;
        color:#e11d48;font:800 8px/12px sans-serif;box-shadow:0 0 0 1px #e11d48;">EST</span>
      ${fav ? `<span style="position:absolute;top:-12px;left:-4px;font-size:12px;color:#f59e0b;text-shadow:0 0 2px #fff;">★</span>` : ""}
    </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" });
}

/** "Estimated position · last real fix 6 min ago at 14:05 · assuming 18 km/h average" */
function estimateText(r: LiveRiderPosition, e: RiderEstimate): string {
  if (e.capped) return `No signal for 45+ min · last real fix at ${hhmm(r.recordedAt)}`;
  const mins = Math.max(1, Math.round((Date.now() - new Date(r.recordedAt).getTime()) / 60_000));
  if (!e.moved) return `No recent signal · last real fix ${mins} min ago at ${hhmm(r.recordedAt)} · no route to estimate along`;
  return `Estimated position · last real fix ${mins} min ago at ${hhmm(r.recordedAt)} · assuming ${Math.round(e.kph)} km/h average`;
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
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

function popupContent(
  r: LiveRiderPosition,
  isCrew: boolean,
  viewer: { lat: number; lng: number } | null,
  progressText: string | null,
  est: RiderEstimate | null = null,
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
  if (est) {
    const e = document.createElement("p");
    e.className = "mt-1 text-xs font-semibold text-cherry-deep";
    e.textContent = estimateText(r, est);
    wrap.appendChild(e);
    if (est.aheadM > 50) {
      const n = document.createElement("p");
      n.className = "text-[11px] text-muted-foreground";
      n.textContent = `May now be ~${(est.aheadM / 1000).toFixed(1)} km further along the route. Navigate and SOS use the last confirmed position.`;
      wrap.appendChild(n);
    }
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

function routesKey(eventId: string) {
  return `rc-routes:${eventId}`;
}
function favKey(eventId: string) {
  return `rc-fav:${eventId}`;
}

function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
  return ((Math.atan2(y, x) / r) + 360) % 360;
}

function followKey(eventId: string) {
  return `rce-follow-${eventId}`;
}

const ALL_DAYS = "__all__";

export default function LiveTrackingMapInner({
  eventId,
  isCrew = false,
  focusUserId = null,
  trackRider = null,
  onOffCourse,
  riderMode = false,
  onFocusedProgress,
  currentPosition = null,
  fieldToken,
  onResolveRiderSos,
}: {
  /** No-sign-in field link token (medics/marshals). */
  fieldToken?: string;
  onResolveRiderSos?: (userId: string) => Promise<void>;
  eventId: string;
  isCrew?: boolean;
  /** Race control can jump the map to a specific rider. */
  focusUserId?: string | null;
  /** Follow a rider picked by name/race number (e.g. a starred rider from results). */
  trackRider?: { name: string; bib: string | null } | null;
  /** Reports riders sitting far off the course line (metres), for the watch list. */
  onOffCourse?: (map: Record<string, number>) => void;
  /** Compact, map-first view embedded in the rider's own tracking controls. */
  riderMode?: boolean;
  onFocusedProgress?: (progress: ReturnType<typeof progressOnCourse>) => void;
  currentPosition?: { lat: number; lng: number } | null;
}) {
  // The Leaflet element is owned here and moved between the inline and the
  // full-screen host, so the map keeps its state when switching views.
  const [mapEl] = useState(() => {
    const d = document.createElement("div");
    d.style.width = "100%";
    d.style.height = "100%";
    return d;
  });
  const containerRef = useRef<HTMLDivElement | null>(mapEl);
  const hostRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (el && mapEl.parentElement !== el) {
        el.appendChild(mapEl);
        window.setTimeout(() => mapRef.current?.invalidateSize(), 30);
      }
    },
    [mapEl],
  );
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const circlesRef = useRef<Map<string, L.Circle>>(new Map());
  const animRef = useRef<Map<string, number>>(new Map());
  const fittedRef = useRef(false);
  const programmaticMoveRef = useRef(false);
  const [follow, setFollow] = useState<string | null>(null);
  const [followPaused, setFollowPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fsTools, setFsTools] = useState(false);
  const [sheetTall, setSheetTall] = useState(false);
  const [routesOpen, setRoutesOpen] = useState(false);
  const [baseLayer, setBaseLayer] = useState("Street");
  const baseLayersRef = useRef<Record<string, L.TileLayer>>({});
  const [resolving, setResolving] = useState(false);
  const resolveSos = async (r: { userId: string; riderName?: string | null }) => {
    if (!onResolveRiderSos) return;
    if (!window.confirm(`Mark the SOS for ${r.riderName ?? "this rider"} as sorted?`)) return;
    setResolving(true);
    try {
      await onResolveRiderSos(r.userId);
      toast.success("SOS marked sorted — your name is recorded");
    } catch {
      toast.error("Couldn't resolve SOS — try again");
    } finally {
      setResolving(false);
    }
  };
  const [tab, setTab] = useState<"all" | "fav" | "finished" | "points">("all");
  const [favs, setFavs] = useState<string[]>([]);
  useEffect(() => {
    try {
      setFavs(JSON.parse(localStorage.getItem(favKey(eventId)) ?? "[]"));
    } catch {
      /* ignore */
    }
  }, [eventId]);
  const toggleFav = useCallback(
    (id: string) => {
      setFavs((cur) => {
        const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
        try {
          localStorage.setItem(favKey(eventId), JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [eventId],
  );

  // Full screen: phone back button / Escape close it; Leaflet needs a resize.
  const openFullscreen = useCallback(() => {
    setFullscreen(true);
    try {
      window.history.pushState({ rcLiveFs: true }, "");
    } catch {
      /* ignore */
    }
  }, []);
  const closeFullscreen = useCallback(() => {
    if (window.history.state?.rcLiveFs) window.history.back();
    else setFullscreen(false);
  }, []);
  useEffect(() => {
    if (!fullscreen) return;
    const onPop = () => setFullscreen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFullscreen();
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen, closeFullscreen]);
  useEffect(() => {
    const t = window.setTimeout(() => mapRef.current?.invalidateSize(), 60);
    return () => window.clearTimeout(t);
  }, [fullscreen, sheetTall, fsTools]);
  const [search, setSearch] = useState("");
  const [showFinished, setShowFinished] = useState(false);
  const [viewerLoc, setViewerLoc] = useState<{ lat: number; lng: number; heading?: number | null } | null>(null);
  // Google-Maps-style navigation: keep "me" centred (crew) and turn the map so
  // the direction of travel points up.
  const [followMe, setFollowMe] = useState(false);
  const [headingUp, setHeadingUp] = useState(false);
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
  const trackedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!trackRider) return;
    const key = `${trackRider.name}|${trackRider.bib ?? ""}`;
    if (trackedKeyRef.current === key) return;
    const n = (v: string | null | undefined) => (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const hit = allRiders.find(
      (r) => (trackRider.bib && r.bib && n(r.bib) === n(trackRider.bib)) || (r.riderName && n(r.riderName) === n(trackRider.name)),
    );
    if (hit) {
      trackedKeyRef.current = key;
      startFollowing(hit.userId);
      setSelectedId(hit.userId);
    }
  }, [trackRider, allRiders, startFollowing]);
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

  // Viewer location for crew distance/bearing, guide line and the "me" dot.
  const crewTools = isCrew && !riderMode;
  const [locError, setLocError] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const requestLocation = useCallback((centre: boolean) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocError("This phone can't share its location.");
      return;
    }
    const onPos = (p: GeolocationPosition) => {
      setLocError(null);
      setViewerLoc({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        heading: p.coords.speed != null && p.coords.speed > 1 ? p.coords.heading : null,
      });
    };
    const onErr = (e: GeolocationPositionError) =>
      setLocError(
        e.code === 1
          ? "Location is blocked. Allow location for this site in your browser settings, then tap again."
          : "Couldn't get your location yet — step outside or tap again.",
      );
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onPos(p);
        const map = mapRef.current;
        if (centre && map) {
          setFollowPaused(true);
          programmaticMoveRef.current = true;
          map.setView([p.coords.latitude, p.coords.longitude], Math.max(map.getZoom(), 16));
          window.setTimeout(() => (programmaticMoveRef.current = false), 700);
        }
      },
      onErr,
      { enableHighAccuracy: true, timeout: 15000 },
    );
    if (watchRef.current == null) {
      watchRef.current = navigator.geolocation.watchPosition(onPos, () => {}, {
        enableHighAccuracy: true,
      });
    }
  }, []);
  useEffect(() => {
    if (!isCrew) return;
    requestLocation(false);
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };
  }, [isCrew, requestLocation]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, rotate: true, touchRotate: false, rotateControl: false, bearing: 0 } as L.MapOptions).setView([-29.5, 24.5], 6);
    // On phones (rider/spectator) a one-finger swipe scrolls the page instead of
    // getting trapped by the map; two fingers move/zoom the map. Race control
    // (crew) moves the map with one finger.
    if (!isCrew && window.matchMedia("(pointer: coarse)").matches) {
      const el = containerRef.current;
      map.dragging.disable();
      el.style.touchAction = "pan-y";
      const onTouch = (e: TouchEvent) => {
        if (e.touches.length >= 2) map.dragging.enable();
        else map.dragging.disable();
      };
      el.addEventListener("touchstart", onTouch, { passive: true });
      el.addEventListener("touchend", onTouch, { passive: true });
    }
    const streetLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    const satelliteLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Imagery &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
        maxZoom: 19,
      },
    );
    baseLayersRef.current = { Street: streetLayer, Satellite: satelliteLayer };
    // Crew use this outdoors in bright sun — lift the base map so routes and
    // markers stay readable on a dim phone screen.
    if (isCrew) {
      const tilePane = map.getPane("tilePane");
      if (tilePane) tilePane.style.filter = "brightness(1.18) saturate(1.2) contrast(1.05)";
    }

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
  useHydratedStore();
  const event = useAdminStore((s) => s.events.find((e) => e.id === eventId));
  const [candidates, setCandidates] = useState<RouteCandidate[]>([]);
  const routeLayersRef = useRef<Map<string, L.Polyline[]>>(new Map());

  const allDays = useMemo(
    () => (event ? withRegistrationDayLabels(event.days ?? [], (event.schedule as any) ?? []) : []),
    [event],
  );
  const todayDayIds = useMemo(() => candidateDayIds(event), [event]);

  // Every route on every day is loaded so the picker can switch days.
  const routeSpecs = useMemo(() => {
    const out: { route: any; dayId: string; dayLabel: string }[] = [];
    for (const day of allDays) {
      const dayLabel =
        day.label ||
        new Date(day.date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
      for (const r of day.routes ?? []) {
        if ((r.kmlUrls ?? []).length > 0) out.push({ route: r, dayId: day.id, dayLabel });
      }
    }
    return out;
  }, [allDays]);

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
      await Promise.all(
        routeSpecs.map(async (spec) => {
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
          if (lines.length === 0) return;
          out.push({
            route: spec.route,
            dayId: spec.dayId,
            dayLabel: spec.dayLabel,
            color: spec.route.color || TIER_COLORS[spec.route.tier] || TIER_COLORS.Custom,
            lines,
          });
        }),
      );
      const order = routeSpecs.map((s) => s.route.id);
      out.sort((x, y) => order.indexOf(x.route.id) - order.indexOf(y.route.id));
      if (!cancelled) setCandidates(out);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey]);

  // Day shown in the picker: today on race day, otherwise the first riding day.
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const dayOptions = useMemo(
    () => allDays.filter((d) => candidates.some((c) => c.dayId === d.id)),
    [allDays, candidates],
  );
  // Picker buttons: "All days" first when there's more than one riding day.
  const dayButtons = useMemo(
    () => (dayOptions.length > 1 ? [{ id: ALL_DAYS, label: "All days", date: "" }, ...dayOptions] : dayOptions),
    [dayOptions],
  );
  const activeDayId =
    pickedDay ?? todayDayIds?.find((id) => dayOptions.some((d) => d.id === id)) ?? dayOptions[0]?.id ?? null;
  const dayCandidates = useMemo(
    () => candidates.filter((c) => !activeDayId || activeDayId === ALL_DAYS || c.dayId === activeDayId),
    [candidates, activeDayId],
  );

  // Manually chosen overlays (remembered per event on this phone). null = automatic.
  const [manualRoutes, setManualRoutes] = useState<string[] | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(routesKey(eventId));
      if (raw) setManualRoutes(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [eventId]);
  const saveManual = useCallback(
    (ids: string[] | null) => {
      setManualRoutes(ids);
      try {
        if (ids) localStorage.setItem(routesKey(eventId), JSON.stringify(ids));
        else localStorage.removeItem(routesKey(eventId));
      } catch {
        /* ignore */
      }
    },
    [eventId],
  );

  // Automatic: the route the followed rider entered (by entry class). No guessing by distance.
  const followedRider = useMemo(
    () => allRiders.find((r) => r.userId === (follow ?? focusUserId)) ?? null,
    [allRiders, follow, focusUserId],
  );
  const autoIds = useMemo(() => {
    const cats = followedRider ? [followedRider.category] : riders.map((r) => r.category);
    const ids = new Set<string>();
    for (const c of dayCandidates) if (cats.some((cat) => categoryMatchesRoute(cat, c.route))) ids.add(c.route.id);
    return [...ids];
  }, [followedRider, riders, dayCandidates]);
  // Like the route map: never dump every route faintly — default to the day's first (primary) route.
  const routeUnknown = false;
  const matchedIds = useMemo(() => {
    if (manualRoutes) {
      const ids = manualRoutes.filter((id) => dayCandidates.some((c) => c.route.id === id));
      if (ids.length) return ids;
    }
    if (followedRider && autoIds.length > 0) return autoIds;
    return dayCandidates[0] ? [dayCandidates[0].route.id] : [];
  }, [manualRoutes, autoIds, dayCandidates, followedRider]);
  const matchedRoutes = useMemo(
    () => candidates.filter((c) => matchedIds.includes(c.route.id)),
    [candidates, matchedIds],
  );
  const toggleRoute = (id: string) => {
    const base = matchedIds;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    saveManual(next.length ? next : [id]);
  };
  const pickDay = (id: string) => {
    setPickedDay(id);
    if (id === ALL_DAYS) {
      saveManual(candidates.length ? candidates.map((c) => c.route.id) : null);
      return;
    }
    const first = candidates.find((c) => c.dayId === id);
    saveManual(first ? [first.route.id] : null);
  };

  // Follow the elevation-profile scrub on the map (mouse or finger), like the route map.
  const profileHover = useRouteHover();
  const hoverMarkerRef = useRef<L.Marker | null>(null);
  const scrubbingRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!profileHover) {
      scrubbingRef.current = false;
      hoverMarkerRef.current?.remove();
      hoverMarkerRef.current = null;
      return;
    }
    const ll = L.latLng(profileHover.lat, profileHover.lng);
    const rot = profileHover.bearing ?? 0;
    const icon = L.divIcon({
      className: "rce-hover-marker",
      html: profileHover.bearing === undefined
        ? `<div style="width:22px;height:22px;border-radius:9999px;background:#e11d48;border:3px solid #fff;box-shadow:0 0 0 3px rgba(225,29,72,.35);"></div>`
        : `<div style="width:34px;height:34px;display:grid;place-items:center;border-radius:9999px;background:#e11d48;border:3px solid #fff;box-shadow:0 0 0 4px rgba(225,29,72,.3),0 2px 6px rgba(0,0,0,.35);transform:rotate(${rot}deg)"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2 L20 20 L12 15 L4 20 Z" fill="#fff"/></svg></div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    if (hoverMarkerRef.current) {
      hoverMarkerRef.current.setLatLng(ll).setIcon(icon);
    } else {
      hoverMarkerRef.current = L.marker(ll, { icon, interactive: false, zIndexOffset: 2000 }).addTo(map);
    }
    if (!scrubbingRef.current) {
      scrubbingRef.current = true;
      if (map.getZoom() < 13) {
        map.setView(ll, 14, { animate: true });
        return;
      }
    }
    if (!map.getBounds().pad(-0.3).contains(ll)) map.panTo(ll, { animate: true, duration: 0.35 });
  }, [profileHover]);

  // Draw the course underneath the rider markers (same style as the route map).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [, polys] of routeLayersRef.current) polys.forEach((p) => p.remove());
    routeLayersRef.current.clear();

    const bounds: [number, number][] = [];
    for (const c of matchedRoutes) {
      const polys = c.lines.map((line) => {
        const latlngs = line.map(([lng, lat]) => [lat, lng] as [number, number]);
        for (const ll of latlngs) bounds.push(ll);
        return L.polyline(latlngs, { color: c.color, weight: 5, opacity: 0.95 })
          .addTo(map)
          .bindTooltip(`${c.route.name} · ${c.dayLabel}`, { sticky: true });
      });
      routeLayersRef.current.set(c.route.id, polys);
      polys.forEach((p) => p.bringToBack());
    }

    if (!fittedRef.current && bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.1));
    }
    const stopArrows = addDirectionArrows(
      map,
      matchedRoutes.flatMap((c) => c.lines.map((line) => ({ color: c.color, coords: line.map(([lng, lat]) => [lat, lng] as [number, number]) }))),
    );

    return () => {
      stopArrows();
      for (const [, polys] of routeLayersRef.current) polys.forEach((p) => p.remove());
      routeLayersRef.current.clear();
    };
  }, [matchedRoutes]);

  // Course line used for progress + off-course checks: the followed rider's route.
  const course: CourseLine | null = useMemo(() => {
    const pick =
      matchedRoutes.find((c) => followedRider && categoryMatchesRoute(followedRider.category, c.route)) ??
      matchedRoutes[0];
    return pick ? buildCourseLine(pick.lines) : null;
  }, [matchedRoutes, followedRider]);

  const progressFor = useCallback(
    (r: LiveRiderPosition) => (course ? progressOnCourse(course, r.lat, r.lng) : null),
    [course],
  );

  // Display-only position estimates for riders whose phone has gone quiet.
  const [estTick, setEstTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setEstTick((t) => t + 1), 5_000);
    return () => window.clearInterval(id);
  }, []);
  const riderCourses = useMemo(() => {
    const m = new Map<string, CourseLine | null>();
    for (const c of dayCandidates) m.set(c.route.id, buildCourseLine(c.lines));
    return m;
  }, [dayCandidates]);
  const estimates = useMemo(() => {
    void estTick;
    const out = new Map<string, RiderEstimate>();
    for (const r of riders) {
      if (r.finished || r.sos) continue;
      const cand = dayCandidates.find((c) => categoryMatchesRoute(r.category, c.route));
      const cl = cand ? riderCourses.get(cand.route.id) ?? null : course;
      const first = r.firstRecordedAt && r.firstLat != null && r.firstLng != null
        ? { lat: r.firstLat, lng: r.firstLng, recordedAt: r.firstRecordedAt }
        : null;
      const e = estimateRider(cl, r, first);
      if (e) out.set(r.userId, e);
    }
    return out;
  }, [riders, dayCandidates, riderCourses, course, estTick]);
  const estLinesRef = useRef(new Map<string, L.Polyline>());
  const [estNoticeHidden, setEstNoticeHidden] = useState(false);
  useEffect(() => {
    try { setEstNoticeHidden(sessionStorage.getItem("rce-est-notice") === "1"); } catch { /* ignore */ }
  }, []);

  // Race leaders: per entry class, who is furthest along their own route.
  const leaders = useMemo(() => {
    const courses = new Map<string, CourseLine | null>();
    const groups = new Map<string, { r: LiveRiderPosition; km: number; totalKm: number }[]>();
    for (const r of allRiders) {
      if (r.finished) continue;
      const cat = (r.category ?? "").trim() || "Uncategorised";
      const cand = dayCandidates.find((c) => categoryMatchesRoute(r.category, c.route));
      if (!cand) continue;
      if (!courses.has(cand.route.id)) courses.set(cand.route.id, buildCourseLine(cand.lines));
      const cl = courses.get(cand.route.id);
      if (!cl) continue;
      const p = progressOnCourse(cl, r.lat, r.lng);
      if (!p || p.offCourseM > 500) continue;
      groups.set(cat, [...(groups.get(cat) ?? []), { r, km: p.alongM / 1000, totalKm: p.totalM / 1000 }]);
    }
    return [...groups.entries()]
      .map(([cat, list]) => ({ cat, list: list.sort((a, b) => b.km - a.km) }))
      .sort((a, b) => a.cat.localeCompare(b.cat));
  }, [allRiders, dayCandidates]);

  // Key on primitive coords so a fresh {lat,lng} object from the parent each
  // render doesn't recompute progress and loop through onFocusedProgress.
  const posLat = currentPosition?.lat ?? null;
  const posLng = currentPosition?.lng ?? null;

  const focusedProgress = useMemo(() => {
    if (posLat !== null && posLng !== null && course) {
      return progressOnCourse(course, posLat, posLng);
    }
    const focused = focusUserId ? riders.find((r) => r.userId === focusUserId) : null;
    return focused ? progressFor(focused) : null;
  }, [posLat, posLng, course, focusUserId, riders, progressFor]);

  useEffect(() => {
    onFocusedProgress?.(focusedProgress);
  }, [focusedProgress, onFocusedProgress]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !riderMode || posLat === null || posLng === null) return;
    if (!ownMarkerRef.current) {
      ownMarkerRef.current = L.marker([posLat, posLng], {
        icon: markerIcon("live", false),
        zIndexOffset: 900,
      }).addTo(map).bindTooltip("You", { permanent: true, direction: "top", offset: [0, -8] });
    } else {
      ownMarkerRef.current.setLatLng([posLat, posLng]);
    }
    if (!followPaused) {
      programmaticMoveRef.current = true;
      map.setView([posLat, posLng], Math.max(map.getZoom(), 15));
      window.setTimeout(() => (programmaticMoveRef.current = false), 700);
    }
  }, [posLat, posLng, followPaused, riderMode]);

  // ---- Crew tools: "me" dot + waterpoints/aid stations -----------------
  const meMarkerRef = useRef<L.Marker | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !crewTools || !viewerLoc) return;
    if (!meMarkerRef.current) {
      meMarkerRef.current = L.marker([viewerLoc.lat, viewerLoc.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:18px;height:18px;border-radius:9999px;background:#0284c7;border:3px solid #fff;box-shadow:0 0 0 6px rgba(2,132,199,.3)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
        zIndexOffset: 950,
      })
        .addTo(map)
        .bindTooltip("You", { permanent: true, direction: "top", offset: [0, -10] });
    } else {
      meMarkerRef.current.setLatLng([viewerLoc.lat, viewerLoc.lng]);
    }
    if (followMe && !followPaused) {
      programmaticMoveRef.current = true;
      map.panTo([viewerLoc.lat, viewerLoc.lng], { animate: true, duration: 0.5 });
      window.setTimeout(() => (programmaticMoveRef.current = false), 700);
    }
  }, [viewerLoc, crewTools, followMe, followPaused]);

  // ---- Heading-up: rotate the map to the followed target's travel direction ----
  const headingTarget = useMemo(() => {
    if (riderMode) return currentPosition ? { lat: currentPosition.lat, lng: currentPosition.lng, heading: null } : null;
    if (crewTools && followMe) return viewerLoc;
    const id = follow ?? selectedId;
    const r = id ? riders.find((x) => x.userId === id) : null;
    return r ? { lat: r.lat, lng: r.lng, heading: null } : null;
  }, [riderMode, currentPosition, crewTools, followMe, viewerLoc, follow, selectedId, riders]);
  const headingAnchorRef = useRef<{ lat: number; lng: number } | null>(null);
  const headingRef = useRef<number | null>(null);
  useEffect(() => {
    const map = mapRef.current as (L.Map & { setBearing?: (d: number) => void }) | null;
    if (!map?.setBearing) return;
    if (!headingUp) {
      map.setBearing(0);
      headingAnchorRef.current = null;
      return;
    }
    if (!headingTarget) return;
    if (headingTarget.heading != null && !Number.isNaN(headingTarget.heading)) {
      headingRef.current = headingTarget.heading;
    } else {
      const a = headingAnchorRef.current;
      if (!a) headingAnchorRef.current = { lat: headingTarget.lat, lng: headingTarget.lng };
      else if (L.latLng(a).distanceTo([headingTarget.lat, headingTarget.lng]) > 12) {
        headingRef.current = bearingDeg(a, headingTarget);
        headingAnchorRef.current = { lat: headingTarget.lat, lng: headingTarget.lng };
      }
    }
    if (headingRef.current != null && !followPaused) map.setBearing(-headingRef.current);
  }, [headingTarget, headingUp, followPaused]);

  // ---- Open on the course: fit every route once they load ---------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fittedRef.current || candidates.length === 0) return;
    const b: [number, number][] = [];
    for (const c of candidates) for (const line of c.lines) for (const [lng, lat] of line) b.push([lat, lng]);
    if (b.length === 0) return;
    programmaticMoveRef.current = true;
    map.fitBounds(L.latLngBounds(b).pad(0.08));
    fittedRef.current = true;
    window.setTimeout(() => (programmaticMoveRef.current = false), 700);
  }, [candidates]);

  // ---- Team locations: crew see each other; sharing only near the course ----
  const distToCourse = useMemo(() => {
    if (!viewerLoc || candidates.length === 0) return null;
    let best = Infinity;
    for (const c of candidates)
      for (const line of c.lines)
        for (const [lng, lat] of line) {
          const d = metres(viewerLoc, { lat, lng });
          if (d < best) best = d;
        }
    return best;
  }, [viewerLoc, candidates]);
  const nearCourse = distToCourse != null && distToCourse <= SHARE_RADIUS_M;
  const [sharing, setSharing] = useState(false);
  const { isAdmin } = useIsAdmin();
  // Only admins, and only from 3 days before race day, can share their location.
  const shareAllowed = !fieldToken && isAdmin && inRaceLocationWindow((event as { date?: string } | undefined)?.date, event?.days);
  const [teamName, setTeamName] = useState("");
  const [deviceId, setDeviceId] = useState("");
  useEffect(() => {
    try {
      let id = localStorage.getItem("rc-team-device");
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("rc-team-device", id);
      }
      setDeviceId(id);
      setTeamName(localStorage.getItem("rc-team-name") ?? "");
      setSharing(localStorage.getItem(`rc-team-share:${eventId}`) === "1");
    } catch {
      /* ignore */
    }
  }, [eventId]);
  const toggleSharing = () => {
    if (!sharing) {
      let name = teamName;
      if (!name) {
        name = (window.prompt("Your name (shown to the team on the map)") ?? "").trim().slice(0, 60);
        if (!name) return;
        setTeamName(name);
        try { localStorage.setItem("rc-team-name", name); } catch { /* ignore */ }
      }
      if (!viewerLoc) requestLocation(false);
    }
    const next = !sharing;
    setSharing(next);
    try { localStorage.setItem(`rc-team-share:${eventId}`, next ? "1" : "0"); } catch { /* ignore */ }
  };
  const lastSentRef = useRef(0);
  useEffect(() => {
    if (!crewTools || !shareAllowed || !sharing || !nearCourse || !viewerLoc || !deviceId || !teamName) return;
    if (Date.now() - lastSentRef.current < 15_000) return;
    lastSentRef.current = Date.now();
    const payload = { data: { eventId, token: fieldToken, deviceId, name: teamName, lat: viewerLoc.lat, lng: viewerLoc.lng } };
    (fieldToken ? shareTeamLocationField(payload) : shareTeamLocationCrew(payload)).catch(() => {});
  }, [crewTools, shareAllowed, sharing, nearCourse, viewerLoc, deviceId, teamName, eventId, fieldToken]);
  const { data: team } = useQuery({
    queryKey: ["team-locations", eventId, fieldToken ?? ""],
    queryFn: () =>
      fieldToken
        ? fetchTeamLocationsField({ data: { eventId, token: fieldToken } })
        : fetchTeamLocationsCrew({ data: { eventId } }),
    enabled: crewTools,
    refetchInterval: 15_000,
  });
  const teamMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const t of team ?? []) {
      if (t.deviceId === deviceId) continue;
      seen.add(t.deviceId);
      const label = `${t.name} · crew`;
      const ex = teamMarkersRef.current.get(t.deviceId);
      if (ex) {
        ex.setLatLng([t.lat, t.lng]);
        ex.setTooltipContent(label);
      } else {
        const m = L.marker([t.lat, t.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:16px;height:16px;border-radius:4px;background:#7c3aed;border:3px solid #fff;box-shadow:0 0 0 4px rgba(124,58,237,.3)"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
          zIndexOffset: 940,
        })
          .addTo(map)
          .bindTooltip(label, { permanent: true, direction: "top", offset: [0, -10] })
          .bindPopup(
            `<b>${t.name.replace(/[<>&]/g, "")}</b><br/><a href="https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lng}" target="_blank" rel="noreferrer">Navigate</a>`,
          );
        teamMarkersRef.current.set(t.deviceId, m);
      }
    }
    for (const [id, m] of teamMarkersRef.current) {
      if (!seen.has(id)) {
        m.remove();
        teamMarkersRef.current.delete(id);
      }
    }
  }, [team, deviceId]);

  const fieldPoints = useMemo(() => {
    if (!crewTools) return [] as FieldPoint[];
    const byKey = new Map<string, FieldPoint>();
    for (const c of dayCandidates) {
      for (const m of (c.route.customMarkers ?? []) as CustomMarker[]) {
        if (!["water", "aid", "food", "start", "finish"].includes(m.icon ?? "")) continue;
        const key = `${m.name}|${m.lat.toFixed(4)}|${m.lng.toFixed(4)}`;
        const ex = byKey.get(key);
        if (ex) ex.routes.push(c.route.name);
        else byKey.set(key, { key, name: m.name, lat: m.lat, lng: m.lng, icon: m.icon ?? "water", routes: [c.route.name] });
      }
    }
    return [...byKey.values()];
  }, [crewTools, dayCandidates]);

  // Every point dropped on the day's routes (marshals, waterpoints, sponsors…), for the map layer.
  const mapPoints = useMemo(() => {
    const byKey = new Map<string, FieldPoint & { logoUrl?: string; color?: string }>();
    for (const c of dayCandidates) {
      for (const m of (c.route.customMarkers ?? []) as CustomMarker[]) {
        if (!crewTools && (m.icon === "warning" || m.icon === "aid")) continue; // marshals/medics: crew/admin only
        const key = `${m.name}|${m.lat.toFixed(4)}|${m.lng.toFixed(4)}`;
        const ex = byKey.get(key);
        if (ex) ex.routes.push(c.route.name);
        else byKey.set(key, { key, name: m.name, lat: m.lat, lng: m.lng, icon: m.icon ?? "pin", routes: [c.route.name], logoUrl: m.logoUrl, color: m.color });
      }
    }
    return [...byKey.values()];
  }, [crewTools, dayCandidates]);
  const [hiddenTypes, setHiddenTypes] = useState<string[]>([]);
  const pointTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of mapPoints) {
      const t = p.logoUrl ? "sponsor" : p.icon;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [mapPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapPoints.length === 0) return;
    const shown = mapPoints.filter((p) => !hiddenTypes.includes(p.logoUrl ? "sponsor" : p.icon));
    const layer = L.layerGroup(
      shown.map((pt) => {
        const glyph = POINT_TYPE[pt.icon]?.glyph ?? "📍";
        const wrap = document.createElement("div");
        wrap.className = "font-sans text-sm";
        const t = document.createElement("p");
        t.className = "font-bold";
        t.textContent = pt.name;
        const r = document.createElement("p");
        r.className = "text-xs opacity-70";
        r.textContent = pt.routes.join(" · ");
        const a = document.createElement("a");
        a.href = navUrl(pt.lat, pt.lng);
        a.target = "_blank";
        a.rel = "noreferrer";
        a.textContent = "Open in Google Maps →";
        a.style.cssText = "display:inline-block;margin-top:6px;font-weight:700;color:#e11d48";
        wrap.append(t, r, a);
        const border = pt.color || POINT_TYPE[pt.icon]?.color || "#334155";
        const html = pt.logoUrl
          ? `<div style="width:56px;height:24px;border-radius:8px;background:#fff;border:2px solid ${border};display:flex;align-items:center;justify-content:center;padding:2px 4px;box-shadow:0 1px 6px rgba(0,0,0,.35)"><img src="${pt.logoUrl}" alt="" style="width:100%;height:100%;object-fit:contain"/></div>`
          : `<div style="width:26px;height:26px;border-radius:8px;background:#fff;border:2px solid ${border};display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 1px 6px rgba(0,0,0,.35)">${glyph}</div>`;
        const w = pt.logoUrl ? 56 : 26;
        const h = pt.logoUrl ? 24 : 26;
        return L.marker([pt.lat, pt.lng], {
          icon: L.divIcon({ className: "", html, iconSize: [w, h], iconAnchor: [w / 2, h / 2] }),
          zIndexOffset: 500,
        })
          .bindTooltip(pt.name, { permanent: true, direction: "bottom", offset: [0, h / 2], className: "rce-marker-label rce-marker-label-sm" })
          .bindPopup(wrap);
      }),
    ).addTo(map);
    return () => {
      layer.remove();
    };
  }, [mapPoints, hiddenTypes]);

  const focusPoint = (pt: FieldPoint) => {
    const map = mapRef.current;
    if (!map) return;
    setFollowPaused(true);
    programmaticMoveRef.current = true;
    map.setView([pt.lat, pt.lng], Math.max(map.getZoom(), 16));
    window.setTimeout(() => (programmaticMoveRef.current = false), 700);
    if (fullscreen) setSheetTall(false);
  };

  const centreOnMe = () => {
    const map = mapRef.current;
    if (viewerLoc && map) {
      setFollowMe(true);
      setFollowPaused(false);
      programmaticMoveRef.current = true;
      map.setView([viewerLoc.lat, viewerLoc.lng], Math.max(map.getZoom(), 16));
      window.setTimeout(() => (programmaticMoveRef.current = false), 700);
      return;
    }
    requestLocation(true);
  };


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
      const est = estimates.get(r.userId) ?? null;
      const showLat = est ? est.lat : r.lat;
      const showLng = est ? est.lng : r.lng;
      const icon = est ? estimatedIcon(est.capped, favs.includes(r.userId)) : markerIcon(signal, r.sos, favs.includes(r.userId));
      const line = estLinesRef.current.get(r.userId);
      if (est && est.moved && est.aheadM > 5) {
        const pts: [number, number][] = [[r.lat, r.lng], [est.lat, est.lng]];
        if (line) line.setLatLngs(pts);
        else estLinesRef.current.set(r.userId, L.polyline(pts, { color: "#e11d48", weight: 2, opacity: 0.6, dashArray: "2 6", interactive: false }).addTo(map));
      } else if (line) {
        line.remove();
        estLinesRef.current.delete(r.userId);
      }
      const p = progressFor(r);
      const progressText = p && p.offCourseM < 1000 ? formatProgress(p) : null;
      const existing = markersRef.current.get(r.userId);
      if (existing) {
        if (est) existing.setLatLng([showLat, showLng]);
        else animateTo(r.userId, existing, r.lat, r.lng);
        existing.setIcon(icon);
        // An SOS pin must live outside the cluster group so it always shows.
        const inCluster = cluster.hasLayer(existing);
        if (r.sos && inCluster) {
          cluster.removeLayer(existing);
          existing.addTo(map);
        } else if (!r.sos && !inCluster) {
          existing.remove();
          cluster.addLayer(existing);
        }
        if (!crewTools && selectedId === r.userId) {
          existing.setPopupContent(popupContent(r, isCrew, viewerLoc, progressText, est));
        }
      } else {
        const m = L.marker([showLat, showLng], { icon });
        if (crewTools) {
          m.on("click", () => { setSelectedId(r.userId); setFollowPaused(true); });
          m.bindTooltip(r.riderName || r.bib || "Rider", { direction: "top" });
        } else {
          m.bindPopup(popupContent(r, isCrew, viewerLoc, progressText, est));
          m.on("popupopen", () => setSelectedId(r.userId));
          m.on("popupclose", () => setSelectedId((id) => id === r.userId ? null : id));
        }
        if (r.sos) m.addTo(map);
        else cluster.addLayer(m);
        markersRef.current.set(r.userId, m);
      }

      // Faint accuracy halo so viewers can tell a sharp fix from a rough one.
      if ((!crewTools || selectedId === r.userId) && r.accuracyM != null && r.accuracyM > 25) {
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
      if ((follow === r.userId || selectedId === r.userId) && !followPaused && !followMe) {
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
    for (const [id, l] of estLinesRef.current) {
      if (!seen.has(id)) { l.remove(); estLinesRef.current.delete(id); }
    }

    if (!fittedRef.current && bounds.length > 0 && !follow) {
      programmaticMoveRef.current = true;
      map.fitBounds(L.latLngBounds(bounds).pad(0.15));
      fittedRef.current = true;
      window.setTimeout(() => (programmaticMoveRef.current = false), 700);
    }
  }, [riders, follow, followPaused, followMe, isCrew, viewerLoc, selectedId, animateTo, progressFor, favs, estimates]);


  // Draw/refresh the dashed guide line from viewer to selected rider.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (guideLineRef.current) {
      guideLineRef.current.remove();
      guideLineRef.current = null;
    }
    if (crewTools || !isCrew || !viewerLoc || !selectedId) return;
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

  // Re-centre on the course: the shown routes, or every route when none is matched yet.
  const fitCourse = () => {
    const map = mapRef.current;
    if (!map) return;
    const src = matchedRoutes.length ? matchedRoutes : candidates;
    const b: [number, number][] = [];
    for (const c of src) for (const line of c.lines) for (const [lng, lat] of line) b.push([lat, lng]);
    if (!b.length) return;
    setFollowPaused(true);
    programmaticMoveRef.current = true;
    map.fitBounds(L.latLngBounds(b).pad(0.08), { animate: true });
    window.setTimeout(() => (programmaticMoveRef.current = false), 900);
  };

  const focusRider = (r: LiveRiderPosition) => {
    setSelectedId(r.userId);
    startFollowing(r.userId);
    const map = mapRef.current;
    if (map) {
      programmaticMoveRef.current = true;
      map.setView([r.lat, r.lng], Math.max(map.getZoom(), 14));
      window.setTimeout(() => (programmaticMoveRef.current = false), 700);
    }
    if (fullscreen) setSheetTall(false);
  };

  const sheetList = (() => {
    const q = search.trim().toLowerCase();
    let list = tab === "finished" ? allRiders.filter((r) => r.finished) : tab === "fav" ? allRiders.filter((r) => favs.includes(r.userId)) : riders;
    if (q)
      list = list.filter(
        (r) => (r.riderName ?? "").toLowerCase().includes(q) || (r.bib ?? "").toLowerCase().includes(q),
      );
    return [...list].sort(
      (x, y) =>
        (isCrew ? Number(y.sos) - Number(x.sos) : 0) ||
        Number(favs.includes(y.userId)) - Number(favs.includes(x.userId)) ||
        (x.riderName ?? "").localeCompare(y.riderName ?? ""),
    );
  })();

  const freshness = (r: LiveRiderPosition) => {
    const sig = signalOf(r.recordedAt);
    const label = sig === "live" ? formatAgo(r.recordedAt) : sig === "stale" ? `${formatAgo(r.recordedAt)}` : "signal lost";
    const cls = sig === "live" ? "bg-emerald-500/15 text-emerald-700" : sig === "stale" ? "bg-amber-500/15 text-amber-700" : "bg-muted text-muted-foreground";
    const est = estimates.get(r.userId);
    if (est) {
      return <span title={estimateText(r, est)} className="rounded-full border border-dashed border-cherry px-2 py-0.5 text-[10px] font-bold text-cherry-deep">{est.capped ? "No signal 45+ min" : `EST · real fix ${formatAgo(r.recordedAt)}`}</span>;
    }
    return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>;
  };

  const legendRoutes = matchedRoutes;
  const selectedRider = allRiders.find((r) => r.userId === selectedId);

  const renderHeader = () => (
    <>
      {fullscreen ? (
        <div className="flex items-center gap-2 border-b border-border bg-card px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={closeFullscreen}
            aria-label="Close full screen"
            className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-ink"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{event?.name ?? "Live tracking"}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {dayButtons.find((d) => d.id === activeDayId)?.label ?? "Live"} · {riders.length} on course
            </p>
          </div>
          <Button variant={fsTools ? "default" : "outline"} size="sm" type="button" onClick={() => setFsTools((t) => !t)}>
            <Search className="h-3.5 w-3.5" /> {fsTools ? "Hide tools" : "Riders & tools"}
          </Button>
        </div>
      ) : null}

      {!riderMode && !fullscreen ? (
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a rider by name or race number…"
            className="w-full rounded-xl bg-card px-3 py-2 text-sm text-ink ring-1 ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cherry"
          />
        </div>
      ) : null}
      {!riderMode && !fullscreen && search.trim() ? (
        <div className="flex flex-wrap gap-1.5">
          {filtered.slice(0, 8).map((r) => {
            const p = progressFor(r);
            return (
              <button
                key={r.userId}
                type="button"
                onClick={() => focusRider(r)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${
                  follow === r.userId
                    ? "bg-cherry text-white ring-cherry"
                    : "bg-card text-ink ring-border hover:bg-accent"
                }`}
              >
                {favs.includes(r.userId) ? "★ " : ""}
                {r.riderName ?? "Rider"}
                {r.bib ? ` · #${r.bib}` : ""}
                {p && p.offCourseM < 1000 ? ` · ${formatProgress(p)}` : ""}
              </button>
            );
          })}
        </div>
      ) : null}

      {follow && !fullscreen && !riderMode ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-card px-3 py-2 text-xs ring-1 ring-border">
          <span className="font-semibold text-ink">
            Following {followedRider?.riderName ?? "this rider"}
            {followPaused ? " · paused while you move the map" : ""}
          </span>
          <button
            type="button"
            onClick={() => startFollowing(null)}
            className="ml-auto rounded-full bg-secondary px-3 py-1 font-semibold text-secondary-foreground"
          >
            Stop following
          </button>
        </div>
      ) : null}

      {!fullscreen || fsTools ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background p-2" aria-label="Map controls">
          <label className="flex items-center gap-2 text-xs font-semibold text-ink">
            Map
            <select aria-label="Map view" value={baseLayer} onChange={(e) => {
              const map = mapRef.current;
              if (!map) return;
              Object.values(baseLayersRef.current).forEach((layer) => map.removeLayer(layer));
              baseLayersRef.current[e.target.value]?.addTo(map);
              setBaseLayer(e.target.value);
            }} className="h-8 rounded-md border border-border bg-card px-2 text-ink">
              <option>Street</option><option>Satellite</option>
            </select>
          </label>
          {!fullscreen ? (
            <Button variant="outline" size="sm"
              type="button"
              onClick={openFullscreen}
              className="inline-flex items-center gap-1 rounded-md bg-card px-3 py-2 text-xs font-bold text-ink ring-1 ring-border"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Full screen
            </Button>
          ) : null}
          {candidates.length > 0 ? (
            <Button variant="outline" size="sm"
              type="button"
              onClick={() => setRoutesOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-md bg-card px-3 py-2 text-xs font-bold text-ink ring-1 ring-border"
            >
              <Layers className="h-3.5 w-3.5 text-cherry" /> Routes
            </Button>
          ) : null}
          {crewTools ? (
            <Button variant="outline" size="sm"
              type="button"
              onClick={centreOnMe}
              className="inline-flex items-center gap-1 rounded-md bg-card px-3 py-2 text-xs font-bold text-ink ring-1 ring-border"
            >
              <LocateFixed className="h-3.5 w-3.5 text-primary" />{" "}
              {followMe && !followPaused ? "Following me" : viewerLoc ? "Follow me" : "Show my location"}
            </Button>
          ) : null}
          <Button variant="outline" size="sm"
            type="button"
            aria-pressed={headingUp}
            onClick={() => {
              setHeadingUp((h) => !h);
              setFollowPaused(false);
            }}
            className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-bold ring-1 ring-border ${headingUp ? "bg-primary text-primary-foreground" : "bg-card text-ink"}`}
          >
            <Compass className="h-3.5 w-3.5" /> {headingUp ? "Heading up" : "North up"}
          </Button>
          {crewTools && shareAllowed ? (
            <Button variant="outline" size="sm"
              type="button"
              onClick={toggleSharing}
              disabled={!sharing && viewerLoc != null && !nearCourse}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-bold ring-1 ring-border disabled:opacity-60 ${sharing && nearCourse ? "bg-primary text-primary-foreground" : "bg-card text-ink"}`}
            >
              <MapPin className="h-3.5 w-3.5" />
              {viewerLoc && !nearCourse
                ? sharing ? "Off site · paused" : "Off site · sharing locked"
                : !sharing ? "Share with team" : nearCourse ? "Sharing with team" : "Sharing paused"}
            </Button>
          ) : null}
          {crewTools && viewerLoc && !nearCourse ? (
            <p className="max-w-[14rem] rounded-xl bg-card px-3 py-2 text-[11px] text-ink ring-1 ring-border">
              {distToCourse != null ? `You're ${fmtDist(distToCourse)} from the routes. ` : "Routes not loaded yet. "}
              Team sharing unlocks within 2 km of a route — nothing is sent until then.
            </p>
          ) : null}
          {crewTools && locError ? (
            <p className="max-w-[14rem] rounded-xl bg-card px-3 py-2 text-[11px] text-ink ring-1 ring-border">
              {locError}
            </p>
          ) : null}
          <Button variant="outline" size="sm" type="button" onClick={fitCourse} className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-bold shadow-lg">
            <RouteIcon className="h-3.5 w-3.5" /> Show whole route
          </Button>
          {follow && followPaused ? (
            <Button variant="outline" size="sm"
              type="button"
              onClick={() => {
                setFollowPaused(false);
                const r = riders.find((x) => x.userId === follow);
                const map = mapRef.current;
                if (r && map) {
                  programmaticMoveRef.current = true;
                  map.setView([r.lat, r.lng], Math.max(map.getZoom(), 15), { animate: true });
                  window.setTimeout(() => (programmaticMoveRef.current = false), 900);
                }
              }}
              className="inline-flex items-center gap-1 rounded-md bg-cherry px-3 py-2 text-xs font-bold text-primary-foreground shadow-lg"
            >
              <Crosshair className="h-3.5 w-3.5" /> Re-centre
            </Button>
          ) : null}
          {routesOpen ? (
            <div className="w-full rounded-lg bg-card p-3 text-xs ring-1 ring-border">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-bold text-ink">Route overlays</p>
                <Button variant="outline" size="sm" type="button" onClick={() => setRoutesOpen(false)} aria-label="Close routes">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
              {dayOptions.length > 1 ? (
                <div className="mb-2 flex flex-wrap gap-1">
                  {dayButtons.map((d) => (
                    <Button variant="outline" size="sm"
                      key={d.id}
                      type="button"
                      onClick={() => pickDay(d.id)}
                      className={`rounded-md px-2.5 py-1 font-semibold ring-1 ${
                        d.id === activeDayId ? "bg-primary text-primary-foreground ring-cherry" : "bg-card text-ink ring-border"
                      }`}
                    >
                      {d.label}
                    </Button>
                  ))}
                </div>
              ) : null}
              <div className="space-y-1">
                {dayCandidates.map((c) => {
                  const on = matchedIds.includes(c.route.id);
                  return (
                    <Button variant="outline" size="sm"
                      key={c.route.id}
                      type="button"
                      onClick={() => toggleRoute(c.route.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${on ? "bg-accent" : ""}`}
                    >
                      <span
                        className={`grid h-4 w-4 place-items-center rounded border ${on ? "border-cherry bg-primary text-primary-foreground" : "border-border"}`}
                      >
                        {on ? "✓" : ""}
                      </span>
                      <span className="inline-block h-2 w-5 rounded-md" style={{ backgroundColor: c.color }} />
                      <span className="font-medium text-ink">{c.route.name}</span>
                    </Button>
                  );
                })}
              </div>
              {manualRoutes ? (
                <Button variant="outline" size="sm"
                  type="button"
                  onClick={() => saveManual(null)}
                  className="mt-2 w-full rounded-md bg-secondary px-3 py-1.5 font-semibold text-secondary-foreground"
                >
                  Reset to rider's route
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {estimates.size > 0 && !estNoticeHidden ? (
        <div className="flex items-start gap-2 border-b border-border bg-accent px-3 py-2 text-xs text-ink">
          <span className="mt-0.5 grid h-4 w-7 shrink-0 place-items-center rounded border border-dashed border-cherry text-[8px] font-black text-cherry">EST</span>
          <p className="min-w-0 flex-1">Some positions are estimates. Phones stop sharing location when the screen locks or the signal drops (common in valleys and forest). When that happens we move the rider along the route at their average speed so far, until a real update comes in. Estimated dots are hollow and marked EST. For SOS and rescue we always use the rider's last confirmed position.</p>
          <button type="button" aria-label="Dismiss" className="shrink-0 text-ink-soft" onClick={() => { setEstNoticeHidden(true); try { sessionStorage.setItem("rce-est-notice", "1"); } catch { /* ignore */ } }}><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}
      {!fullscreen ? riderCard : null}
    </>
  );

  const riderCard = crewTools && selectedRider ? (
        <div className={fullscreen ? "absolute inset-x-2 bottom-2 z-[1001] rounded-xl bg-card px-3 py-2 shadow-xl ring-1 ring-border" : "shrink-0 border-b border-border bg-card px-3 py-2"} aria-label="Selected rider">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-bold text-ink">{selectedRider.sos ? <span className="mr-2 text-destructive">SOS · {selectedRider.sosReason ?? "Help"}</span> : null}{selectedRider.riderName ?? "Rider"}{selectedRider.bib ? ` · #${selectedRider.bib}` : ""}</p>
              <p className="text-xs text-muted-foreground">{[selectedRider.category, `${signalOf(selectedRider.recordedAt)} · ${formatAgo(selectedRider.recordedAt)}`, selectedRider.batteryPct != null ? `Battery ${selectedRider.batteryPct}%` : null, viewerLoc ? `${fmtDist(metres(viewerLoc, selectedRider))} from you` : null].filter(Boolean).join(" · ")}</p>
              {estimates.get(selectedRider.userId) ? (() => { const e = estimates.get(selectedRider.userId)!; return (
                <p className="mt-0.5 text-xs font-semibold text-cherry-deep">{estimateText(selectedRider, e)}{e.aheadM > 50 ? ` · may now be ~${(e.aheadM / 1000).toFixed(1)} km further along the route` : ""}. Navigate uses the last confirmed position.</p>
              ); })() : null}
            </div>
            <Button variant="ghost" size="icon" aria-label="Close rider details" onClick={() => { setSelectedId(null); startFollowing(null); }}><X /></Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild size="sm"><a href={navUrl(selectedRider.lat, selectedRider.lng)} target="_blank" rel="noopener noreferrer"><Navigation />Google Maps</a></Button>
            <Button variant="outline" size="icon" title="Copy rider location" aria-label="Copy rider location" onClick={() => { void navigator.clipboard.writeText(navUrl(selectedRider.lat, selectedRider.lng)).then(() => toast.success("Location copied")).catch(() => toast.error("Couldn't copy location")); }}><Copy /></Button>
            <Button variant="outline" size="icon" title="Share rider location" aria-label="Share rider location" onClick={async () => { const url = navUrl(selectedRider.lat, selectedRider.lng); try { if (navigator.share) await navigator.share({ title: selectedRider.riderName ?? "Rider location", url }); else { await navigator.clipboard.writeText(url); toast.success("Location link copied"); } } catch { /* cancelled */ } }}><Share2 /></Button>
            <Button variant="outline" size="sm" onClick={() => focusRider(selectedRider)}><Crosshair />Locate rider</Button>
            {selectedRider.sos && onResolveRiderSos ? <Button variant="destructive" size="sm" disabled={resolving} onClick={() => void resolveSos(selectedRider)}><Check />{resolving ? "Resolving…" : "Mark sorted"}</Button> : null}
            {selectedRider.sos && fieldToken ? <span className="self-center text-xs text-muted-foreground">Crew sign-in required to resolve SOS</span> : null}
          </div>
        </div>
      ) : null;

  const sosRiders = crewTools ? allRiders.filter((r) => r.sos) : [];
  const sosPopups = sosRiders.length > 0 ? (
    <div className="pointer-events-none absolute inset-x-2 top-2 z-[1001] max-h-[45%] space-y-1.5 overflow-y-auto">
      {sosRiders.map((r) => (
        <div key={r.userId} className="pointer-events-auto flex items-center gap-2 rounded-xl border-2 border-destructive bg-card p-2 shadow-xl">
          <button type="button" onClick={() => { setSelectedId(r.userId); focusRider(r); }} className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-black text-destructive">SOS · {r.sosReason ?? "Help"}</p>
            <p className="truncate text-sm font-bold text-ink">{r.riderName ?? "Rider"}{r.bib ? ` · #${r.bib}` : ""}</p>
            <p className="truncate text-[11px] text-muted-foreground">{formatAgo(r.recordedAt)}{viewerLoc ? ` · ${fmtDist(metres(viewerLoc, r))} from you` : ""}</p>
          </button>
          <Button asChild size="sm"><a href={navUrl(r.lat, r.lng)} target="_blank" rel="noopener noreferrer"><Navigation />Go</a></Button>
          {onResolveRiderSos ? <Button variant="outline" size="sm" disabled={resolving} onClick={() => void resolveSos(r)}><Check />Sorted</Button> : null}
        </div>
      ))}
    </div>
  ) : null;

  const tree = (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[1000] flex flex-col bg-background"
          : "relative space-y-2"
      }
    >
      {renderHeader()}
      {!fullscreen && candidates.length > 0 ? (
        <div className="space-y-1.5">
          {dayOptions.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {dayButtons.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => pickDay(d.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-border ${d.id === activeDayId ? "bg-ink text-background" : "bg-card text-ink"}`}
                >
                  {d.label ?? d.date}
                </button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {dayCandidates.map((c) => {
              const on = matchedIds.includes(c.route.id);
              return (
                <button
                  key={c.route.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleRoute(c.route.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-border ${on ? "bg-card text-ink" : "bg-background text-ink-soft opacity-60"}`}
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.route.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className={fullscreen ? "relative min-h-0 flex-1" : "relative"}>
        <div
          ref={hostRef}
          className={`${fullscreen ? "h-full" : riderMode ? "h-[52dvh] min-h-80 rounded-2xl ring-1 ring-border" : "h-96 rounded-2xl ring-1 ring-border"} w-full overflow-hidden`}
        />
        {sosPopups}
        {fullscreen && crewTools && selectedRider ? riderCard : null}
      </div>

      {fullscreen && fsTools ? (
        <div
          className={`flex flex-col border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,.12)] ${
            sheetTall ? "h-[60dvh]" : "h-[34dvh]"
          }`}
        >
          <button
            type="button"
            onClick={() => setSheetTall((t) => !t)}
            aria-label={sheetTall ? "Shrink rider list" : "Expand rider list"}
            className="mx-auto my-2 h-1.5 w-12 rounded-full bg-border"
          />
          <div className="px-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSheetTall(true)}
                placeholder="Search name or race number"
                className="w-full rounded-xl bg-background py-2 pl-9 pr-3 text-sm text-ink ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-cherry"
              />
            </div>
            <div className="mt-2 flex gap-1.5 overflow-x-auto">
              {(
                [
                  ["all", `All (${riders.length})`],
                  ["fav", `★ Favourites (${favs.length})`],
                  ["finished", `Finished (${finishedCount})`],
                  ...(crewTools ? ([["points", `Waterpoints (${fieldPoints.length})`]] as const) : []),
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                    tab === k ? "bg-cherry text-white ring-cherry" : "bg-card text-ink ring-border"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {routeUnknown && tab !== "points" ? (
              <p className="mt-2 text-[11px] text-muted-foreground">Route unknown for this rider — choose one under Routes.</p>
            ) : null}
          </div>
          {tab === "points" ? (
            <ul className="mt-2 min-h-0 flex-1 divide-y divide-border overflow-y-auto px-3">
              {fieldPoints.length === 0 ? (
                <li className="py-6 text-center text-xs text-muted-foreground">
                  No waterpoints or aid stations on today's routes yet.
                </li>
              ) : null}
              {[...fieldPoints]
                .sort((a, b) => (viewerLoc ? metres(viewerLoc, a) - metres(viewerLoc, b) : 0))
                .map((pt) => (
                  <li key={pt.key} className="flex items-center gap-2 py-2">
                    <button type="button" onClick={() => focusPoint(pt)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-ink">{pt.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {[pt.routes.join(", "), viewerLoc ? `${fmtDist(metres(viewerLoc, pt))} from you` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </button>
                    <a
                      href={navUrl(pt.lat, pt.lng)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Navigate to ${pt.name}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cherry text-white"
                    >
                      <Navigation className="h-4 w-4" />
                    </a>
                  </li>
                ))}
            </ul>
          ) : (
          <ul className="mt-2 min-h-0 flex-1 divide-y divide-border overflow-y-auto px-3">
            {sheetList.length === 0 ? (
              <li className="py-6 text-center text-xs text-muted-foreground">
                {tab === "fav" ? "Tap the star next to a rider to add them here." : "No riders to show yet."}
              </li>
            ) : null}
            {sheetList.map((r) => {
              const p = progressFor(r);
              const fav = favs.includes(r.userId);
              return (
                <li key={r.userId} className={`flex items-center gap-2 py-2 ${follow === r.userId ? "bg-accent/60" : ""}`}>
                  <button
                    type="button"
                    onClick={() => toggleFav(r.userId)}
                    aria-label={fav ? "Remove favourite" : "Add favourite"}
                    className="grid h-8 w-8 place-items-center"
                  >
                    <Star className={`h-4 w-4 ${fav ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                  </button>
                  <button type="button" onClick={() => focusRider(r)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-semibold text-ink">
                      {isCrew && r.sos ? <span className="mr-1 rounded bg-destructive px-1 text-[10px] text-destructive-foreground">SOS</span> : null}
                      {r.riderName ?? "Rider"}
                      {r.bib ? <span className="text-muted-foreground"> #{r.bib}</span> : null}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[
                        r.category,
                        p && p.offCourseM < 1000 ? formatProgress(p) : null,
                        crewTools && viewerLoc ? `${fmtDist(metres(viewerLoc, r))} from you` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </button>
                  {freshness(r)}
                  {crewTools ? (
                    <a
                      href={navUrl(r.lat, r.lng)}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Navigate to ${r.riderName ?? "rider"}`}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cherry text-white"
                    >
                      <Navigation className="h-4 w-4" />
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
          )}
        </div>
      ) : null}

      {!fullscreen && crewTools && pointTypes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-card p-2 ring-1 ring-border" aria-label="Map points">
          <span className="px-1 text-xs font-semibold text-ink-soft">Points:</span>
          {pointTypes.map(([t, n]) => {
            const on = !hiddenTypes.includes(t);
            const meta = POINT_TYPE[t] ?? POINT_TYPE.pin;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => setHiddenTypes((h) => (on ? [...h, t] : h.filter((x) => x !== t)))}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-border transition ${on ? "bg-ink text-primary-foreground" : "bg-background text-ink-soft line-through"}`}
              >
                <span aria-hidden>{meta.glyph}</span> {meta.label} ({n})
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setHiddenTypes((h) => (h.length ? [] : pointTypes.map(([t]) => t)))}
            className="ml-auto rounded-full px-2.5 py-1 text-xs font-semibold text-cherry"
          >
            {hiddenTypes.length ? "Show all" : "Hide all"}
          </button>
        </div>
      ) : null}

      {!fullscreen && matchedRoutes[0] ? (
        <RouteProfile
          route={matchedRoutes[0].route}
          color={matchedRoutes[0].color}
          markers={((matchedRoutes[0].route.customMarkers ?? []) as CustomMarker[]).filter((m) => crewTools || (m.icon !== "warning" && m.icon !== "aid"))}
        />
      ) : null}

      {!riderMode && !fullscreen && leaders.length > 0 ? (
        <section className="rounded-2xl bg-card p-3 ring-1 ring-border">
          <h3 className="font-display text-sm font-bold text-ink">🏁 Race leaders</h3>
          <p className="text-[11px] text-ink-soft">Furthest along the course in each class. Tap a name to follow on the map.</p>
          <ul className="mt-2 divide-y divide-border">
            {leaders.map(({ cat, list }) => {
              const lead = list[0];
              const second = list[1];
              return (
                <li key={cat} className="py-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">{cat} · {list.length} on course</p>
                  <ol className="mt-1 space-y-0.5">
                    {list.slice(0, 3).map((x, i) => (
                      <li key={x.r.userId} className="flex items-center gap-2 text-sm">
                        <span className="w-5 font-bold text-cherry">{i + 1}.</span>
                        <button type="button" onClick={() => { setFollow(x.r.userId); setFollowPaused(false); }} className="min-w-0 flex-1 truncate text-left font-semibold text-ink underline-offset-2 hover:underline">
                          {x.r.riderName ?? "Rider"}
                        </button>
                        <span className="font-mono text-xs text-ink">{x.km.toFixed(1)} / {x.totalKm.toFixed(0)} km</span>
                        <span className="w-16 text-right font-mono text-xs text-ink-soft">
                          {i === 0 ? (second ? `+${(lead.km - second.km).toFixed(1)} km` : "leader") : `−${(lead.km - x.km).toFixed(1)} km`}
                        </span>
                      </li>
                    ))}
                  </ol>
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-[10px] text-ink-soft">Based on live GPS along the route — official positions come from timing.</p>
        </section>
      ) : null}

      {!riderMode && !fullscreen ? (
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      ) : null}
    </div>
  );
  return fullscreen ? createPortal(tree, document.body) : tree;
}
