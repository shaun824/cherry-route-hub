// Client-only Leaflet view of the event village: the plan image is placed over
// a satellite basemap at its real-world position, hotspots become map markers
// and the rider's live GPS position is shown as a pulsing dot.
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, ImageOverlay, useMap, CircleMarker, Polygon, Popup, Marker } from "react-leaflet";
import { Maximize2, Minimize2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
// Adds bearing support to Leaflet so riders can spin the village map to match
// the direction they are facing (two-finger twist, or the on-map controls).
// The plugin ships as a UMD bundle that patches the global `L`, so expose it
// first. This module is only ever loaded lazily in the browser.
(globalThis as unknown as { L: typeof L }).L = L;
await import("leaflet-rotate");


import type { VillageGeo, VillageHotspot } from "@/lib/village-map";
import { spotColor, spotIcon } from "@/lib/village-map";
import { villageIconSvg } from "@/lib/village-icons";
import { tentFootprintCorners, tentTypeMeta } from "@/lib/village-tents";
import { hasBuildDetail, zoneCentroid, zoneColor, zoneKindLabel, type VillageZone } from "@/lib/village-zones";




/** Crew-only label puck sitting at the centre of a drawn build area. */
function zoneLabelIcon(z: VillageZone, hot: boolean) {
  const label = escapeHtml((z.name || zoneKindLabel(z.kind)).trim());
  const color = hot ? "#c8102e" : zoneColor(z);
  return L.divIcon({
    className: "",
    html: `<span style="display:inline-block;white-space:nowrap;padding:2px 8px;border-radius:9999px;background:${color};color:#fff;font-size:11px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.35)">${label}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

import VillageMapTrackpadZoom from "@/components/village-map-trackpad-zoom";

const M_PER_DEG_LAT = 111320;

function offsetLatLng(geo: VillageGeo, eastM: number, northM: number): [number, number] {
  const rad = ((geo.rotation ?? 0) * Math.PI) / 180;
  const e = eastM * Math.cos(rad) + northM * Math.sin(rad);
  const n = -eastM * Math.sin(rad) + northM * Math.cos(rad);
  const lat = geo.lat + n / M_PER_DEG_LAT;
  const lng = geo.lng + e / (M_PER_DEG_LAT * Math.cos((geo.lat * Math.PI) / 180));
  return [lat, lng];
}

function hotspotLatLng(geo: VillageGeo, spot: VillageHotspot, heightM: number): [number, number] {
  if (Number.isFinite(spot.lat) && Number.isFinite(spot.lng)) return [spot.lat as number, spot.lng as number];
  return offsetLatLng(geo, (spot.x / 100 - 0.5) * geo.widthM, (0.5 - spot.y / 100) * heightM);
}



/** Rotates the image overlay element with CSS (Leaflet has no native rotation). */
function RotateOverlay({ rotation }: { rotation: number }) {
  const map = useMap();
  useEffect(() => {
    if (!rotation) return;
    const apply = () => {
      const img = map.getContainer().querySelector<HTMLImageElement>(".rce-village-overlay");
      if (img) {
        img.style.transformOrigin = "center center";
        img.style.transform = `${img.style.transform.replace(/ rotate\([^)]*\)/g, "")} rotate(${rotation}deg)`;
      }
    };
    apply();
    // Panning translates Leaflet's parent pane, so the image's own rotation
    // does not need to be rewritten when a drag ends. That style write could
    // force a final compositor repaint and expose a blank frame on iOS.
    map.on("zoomend", apply);
    return () => {
      map.off("zoomend", apply);
    };
  }, [map, rotation]);
  return null;
}

/** Keeps the Leaflet map bearing in sync with the rider's rotation controls. */
function BearingSync({ bearing }: { bearing: number }) {
  const map = useMap() as L.Map & { setBearing?: (deg: number) => void };
  useEffect(() => {
    map.setBearing?.(bearing);
  }, [map, bearing]);
  return null;
}

/**
 * With the rotation plugin active, two-finger pan/pinch sets the map view on
 * every frame instead of sliding the panes, so vector layers (area outlines,
 * tent footprints) keep their old screen position until the gesture ends and
 * then snap into place. Re-position the renderers and markers on every `move`
 * frame so the geometry travels with the imagery.
 */
function VectorMoveSync() {
  const map = useMap();
  useEffect(() => {
    let raf = 0;
    const sync = () => {
      raf = 0;
      const renderers = new Set<{ _reset?: () => void }>();
      map.eachLayer((layer) => {
        const l = layer as unknown as {
          _renderer?: { _reset?: () => void };
          _icon?: HTMLElement;
          update?: () => void;
        };
        if (l._renderer) renderers.add(l._renderer);
        if (l._icon && typeof l.update === "function") l.update();
      });
      renderers.forEach((r) => r._reset?.());
    };
    const onMove = () => {
      if (!raf) raf = requestAnimationFrame(sync);
    };
    map.on("move zoom", onMove);
    return () => {
      map.off("move zoom", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [map]);
  return null;
}

/**
 * On touch devices the map only pans with two fingers, so scrolling the page
 * over the map never gets trapped. A one-finger drag surfaces a hint instead.
 */

function TwoFingerPanGate({ fullscreen, onTouch }: { fullscreen: boolean; onTouch: () => void }) {
  const map = useMap();
  const cbRef = useRef(onTouch);
  cbRef.current = onTouch;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
    if (!coarse) return;
    const el = map.getContainer();
    if (fullscreen) map.dragging.enable();
    else map.dragging.disable();

    const onStart = () => cbRef.current();
    if (!fullscreen) el.addEventListener("touchstart", onStart, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      map.dragging.enable();
    };
  }, [map, fullscreen]);

  return null;
}



function FitBounds({ bounds, refitToken }: { bounds: L.LatLngBoundsExpression; refitToken?: number }) {
  const map = useMap();
  const done = useRef(false);
  const lastToken = useRef(0);
  useEffect(() => {
    // Frame the village once, on first mount only. Re-fitting on later renders
    // (zoom changes, new marker arrays) fought the rider's own pinch/scroll
    // gesture and snapped the map straight back to the opening view.
    if (done.current && refitToken === lastToken.current) return;
    done.current = true;
    lastToken.current = refitToken ?? 0;
    // Cap at the highest zoom the satellite imagery actually covers, otherwise
    // the map opens on upscaled/blank tiles.
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 19 });
  }, [map, bounds, refitToken]);
  return null;
}



function Recenter({ position, token }: { position: [number, number] | null; token: number }) {
  const map = useMap();
  useEffect(() => {
    if (position && token > 0) map.flyTo(position, Math.max(map.getZoom(), 18), { duration: 0.8 });
  }, [map, position, token]);
  return null;
}

function escapeHtml(v: string) {
  return v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}


type FocusTarget = { key: string; position: [number, number] } | null;

/**
 * Focuses any selected village object without replacing the viewer's chosen
 * scale. It only adds the minimum zoom needed to separate a genuinely crowded
 * target, and reserves the lower screen for the full-screen detail sheet.
 */
function FocusSelection({
  target,
  neighbours,
  detailOpen,
}: {
  target: FocusTarget;
  neighbours: [number, number][];
  detailOpen: boolean;
}) {
  const map = useMap();
  const last = useRef<string | null>(null);
  useEffect(() => {
    const signature = target ? `${target.key}:${detailOpen ? "sheet" : "plain"}` : null;
    if (!target) {
      last.current = null;
      return;
    }
    if (signature === last.current) return;
    last.current = signature;
    const currentZoom = map.getZoom();
    const targetLatLng = L.latLng(target.position);
    const nearestAt = (candidateZoom: number) => {
      const projected = map.project(targetLatLng, candidateZoom);
      let nearest = Number.POSITIVE_INFINITY;
      for (const position of neighbours) {
        if (position[0] === target.position[0] && position[1] === target.position[1]) continue;
        nearest = Math.min(nearest, projected.distanceTo(map.project(L.latLng(position), candidateZoom)));
      }
      return nearest;
    };
    let targetZoom = currentZoom;
    while (targetZoom < 21 && nearestAt(targetZoom) < 48) targetZoom = Math.min(21, targetZoom + 1);

    const size = map.getSize();
    const reserveBottom = detailOpen ? Math.min(size.y * 0.38, 360) : 0;
    const targetPoint = map.project(targetLatLng, targetZoom);
    const centrePoint = targetPoint.add(L.point(0, reserveBottom / 2));
    const centre = map.unproject(centrePoint, targetZoom);
    map.flyTo(centre, targetZoom, { duration: targetZoom === currentZoom ? 0.45 : 0.65 });
  }, [map, target, neighbours, detailOpen]);
  return null;
}

export type MapTent = { id: string; label: string; lat: number; lng: number; kind?: "tent" | "marker" | null; tent_type?: string | null; rotation?: number | null };


/** Facility marker: a clean coloured icon puck, with its name shown once tapped. */
function facilityIcon(spot: VillageHotspot, active: boolean, showLabel: boolean) {
  const color = spotColor(spot);
  const glyph = villageIconSvg(spotIcon(spot), active ? 15 : 13, "#fff");
  const size = active ? 32 : 26;
  return L.divIcon({
    className: "rce-village-facility",
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <span style="display:grid;width:${size}px;height:${size}px;place-items:center;border-radius:999px;background:${color};border:${
        active ? "2.5px" : "2px"
      } solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)">${glyph}</span>
      ${
        showLabel
          ? `<span style="background:#0f172a;color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:7px;white-space:nowrap;border:1.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)">${escapeHtml(
              spot.title,
            )}</span>`
          : ""
      }
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const CATEGORY_LABEL_PRIORITY: Partial<Record<VillageHotspot["category"], number>> = {
  medical: 100,
  registration: 95,
  toilets: 90,
  start: 88,
  finish: 87,
  food: 82,
  bar: 78,
  parking: 72,
  bike: 70,
  camping: 68,
  shop: 62,
  stage: 60,
};

type LabelCandidate = {
  id: string;
  position: [number, number];
  width: number;
  priority: number;
  selected: boolean;
  kind: "facility" | "zone" | "obstacle";
};

function rectanglesOverlap(a: L.Bounds, b: L.Bounds, gap = 4) {
  const aMin = a.getTopLeft();
  const aMax = a.getBottomRight();
  const bMin = b.getTopLeft();
  const bMax = b.getBottomRight();
  return !(
    aMax.x + gap < bMin.x ||
    aMin.x - gap > bMax.x ||
    aMax.y + gap < bMin.y ||
    aMin.y - gap > bMax.y
  );
}

/** Progressive Mapbox-style label placement: important/selected labels claim
    space first; lower-priority labels appear only when their boxes fit. */
function LabelLayout({ candidates, zoom, onLayout }: {
  candidates: LabelCandidate[];
  zoom: number;
  onLayout: (facilityIds: Set<string>, zoneIds: Set<string>) => void;
}) {
  const map = useMap();
  useEffect(() => {
    const layout = () => {
      const facilities = new Set<string>();
      const zones = new Set<string>();
      const occupied: L.Bounds[] = [];
      const ordered = [...candidates].sort((a, b) => Number(b.selected) - Number(a.selected) || b.priority - a.priority);
      for (const item of ordered) {
        if (!item.selected && zoom < (item.kind === "zone" ? 19.25 : item.kind === "obstacle" ? 20 : 18.75)) continue;
        const p = map.latLngToContainerPoint(item.position);
        const box = L.bounds(
          L.point(p.x - item.width / 2, p.y + 15),
          L.point(p.x + item.width / 2, p.y + 34),
        );
        if (!item.selected && occupied.some((used) => rectanglesOverlap(box, used))) continue;
        occupied.push(box);
        if (item.kind === "facility") facilities.add(item.id);
        if (item.kind === "zone") zones.add(item.id);
      }
      onLayout(facilities, zones);
    };
    layout();
    map.on("moveend zoomend resize rotate", layout);
    return () => {
      map.off("moveend zoomend resize rotate", layout);
    };
  }, [map, candidates, zoom, onLayout]);
  return null;
}






/** Tapping empty map clears the selected point, so the label disappears. */
function ClearOnMapClick({ onClear }: { onClear: () => void }) {
  const map = useMap();
  useEffect(() => {
    map.on("click", onClear);
    return () => {
      map.off("click", onClear);
    };
  }, [map, onClear]);
  return null;
}

/** Tracks the live zoom level so markers can thin out when zoomed out. */
function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const update = () => onZoom(map.getZoom());
    update();
    // Updating React state during every fractional zoom frame remounts large
    // marker collections and is the main source of trackpad lag. Visibility
    // only needs recalculating when the gesture settles.
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [map, onZoom]);
  return null;
}

/**
 * Tracks the visible area so big villages (hundreds of tents across several
 * venues) only ever mount the markers a rider can actually see.
 */
function ViewportWatcher({ onView }: { onView: (b: L.LatLngBounds) => void }) {
  const map = useMap();
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => onView(map.getBounds().pad(0.35)));
    };
    update();
    // Do not push React state on every drag release. Re-rendering the complete
    // Leaflet layer tree at exactly the moment its drag transform is committed
    // can expose a blank compositor frame on mobile Safari. The padded bounds
    // established at mount and refreshed after zoom are deliberately generous;
    // panning itself remains entirely inside Leaflet's imperative renderer.
    map.on("zoomend", update);
    return () => {
      cancelAnimationFrame(frame);
      map.off("zoomend", update);
    };
  }, [map, onView]);
  return null;
}




function tentIcon(label: string, active: boolean) {
  const bg = active ? "#c8102e" : "#1f2937";
  return L.divIcon({
    className: "rce-village-tent",
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <span style="background:${bg};color:#fff;font-size:10px;font-weight:800;padding:2px 6px;border-radius:6px;white-space:nowrap;border:${
        active ? "2px solid #fff" : "1px solid rgba(255,255,255,.6)"
      };box-shadow:0 2px 6px rgba(0,0,0,.35)${active ? ";animation:rce-pulse 1.4s ease-in-out infinite" : ""}">${escapeHtml(
        label,
      )}</span>
      <span style="width:6px;height:6px;background:${bg};transform:rotate(45deg) translateY(-2px);border-radius:1px"></span>
    </div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 14],
  });
}

function normalizedNumber(value: string) {
  const match = value.trim().match(/^(?:tent\s*)?(\d+)$/i);
  return match?.[1] ?? null;
}

export default function VillageMapGeo({
  imageUrl,
  geo,
  hotspots,
  zones = [],
  tents = [],
  selected,
  onSelect,
  zonesInteractive = false,
  onZoneSelect,

  highlightZoneId = null,
  highlightTentId = null,
  fullscreenDetail = null,
  fullscreenControls = null,
}: {
  imageUrl?: string | null;
  geo: VillageGeo;
  hotspots: VillageHotspot[];
  zones?: VillageZone[];
  tents?: MapTent[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  /** crew view: areas can be tapped to open their build detail */
  zonesInteractive?: boolean;
  onZoneSelect?: (id: string | null) => void;
  highlightZoneId?: string | null;
  highlightTentId?: string | null;
  /** Detail panel for the tapped point, docked to the bottom in full screen so
      the point itself stays visible and the map stays interactive. */
  fullscreenDetail?: ReactNode;
  /** Crew layer controls repeated inside the full-screen portal. */
  fullscreenControls?: ReactNode;
}) {


  const [ratio, setRatio] = useState(0.76); // height / width, refined once the image loads
  const [me, setMe] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [recenterToken, setRecenterToken] = useState(0);
  const [viewBoundsToken, setViewBoundsToken] = useState(0);
  const [satellite, setSatellite] = useState(true);
  // Villages can save a default orientation so everyone opens the map the same
  // way round as the field is actually built.
  const [bearing, setBearing] = useState(geo.bearing ?? 0);
  // Full-screen expand: the same live map instance just fills the viewport, so
  // the rider's current zoom/position is kept. Works on every device (unlike
  // the native Fullscreen API, which iPhone Safari refuses for divs).
  const [fullscreen, setFullscreen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const fullscreenHistoryKey = useRef(`village-map-${Math.random().toString(36).slice(2)}`);

  const [zoom, setZoom] = useState(17);
  const [view, setView] = useState<L.LatLngBounds | null>(null);
  const [facilityLabels, setFacilityLabels] = useState<Set<string>>(() => new Set());
  const [zoneLabels, setZoneLabels] = useState<Set<string>>(() => new Set());
  const inView = useCallback(
    (lat: number, lng: number) => !view || view.contains(L.latLng(lat, lng)),
    [view],
  );

  // Shown once as the map loads on touch devices, then dismissed for good on
  // the first touch — re-showing it on every single tap got in the way.
  const [twoFingerHint, setTwoFingerHint] = useState(false);
  const hintTimer = useRef<number | null>(null);
  const dismissTwoFingerHint = useCallback(() => {
    if (hintTimer.current) window.clearTimeout(hintTimer.current);
    setTwoFingerHint(false);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia?.("(pointer: coarse)")?.matches) return;
    setTwoFingerHint(true);
    hintTimer.current = window.setTimeout(() => setTwoFingerHint(false), 4000);
    return () => {
      if (hintTimer.current) window.clearTimeout(hintTimer.current);
    };
  }, []);

  const watchRef = useRef<number | null>(null);



  useEffect(() => {
    if (!imageUrl) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0) setRatio(img.naturalHeight / img.naturalWidth);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
  }, []);

  // Full-screen: freeze the page behind the map and tell Leaflet its container
  // changed size, otherwise tiles/markers keep the old dimensions.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = fullscreen ? "hidden" : previousOverflow;
    const t = window.setTimeout(() => mapRef.current?.invalidateSize(), 80);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(t);
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (window.history.state?.villageFullscreen === fullscreenHistoryKey.current) window.history.back();
        else setFullscreen(false);
      }
    };
    const onPopState = () => setFullscreen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPopState);
    };
  }, [fullscreen]);

  const toggleFullscreen = useCallback(() => {
    if (fullscreen) {
      if (window.history.state?.villageFullscreen === fullscreenHistoryKey.current) window.history.back();
      else setFullscreen(false);
      return;
    }
    window.history.pushState(
      { ...window.history.state, villageFullscreen: fullscreenHistoryKey.current },
      "",
    );
    setFullscreen(true);
  }, [fullscreen]);

  const showOverlay = !!imageUrl && (geo.widthM ?? 0) > 0;
  const heightM = (geo.widthM || 300) * ratio;
  const bounds = useMemo<L.LatLngBoundsExpression>(() => {
    if (!showOverlay) {
      // No scaled plan image: frame whatever geography we do have — drawn zones
      // (tent blocks) first, then any pinned hotspots.
      const pts: [number, number][] = [];
      for (const z of zones) {
        for (const p of z.points ?? []) {
          if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) pts.push([p.lat, p.lng]);
        }
      }
      for (const s of hotspots) {
        if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) pts.push([s.lat as number, s.lng as number]);
      }
      if (pts.length > 0) return L.latLngBounds(pts).pad(0.25);
      const flat: VillageGeo = { ...geo, rotation: 0, widthM: 300 };
      return [offsetLatLng(flat, -150, -150), offsetLatLng(flat, 150, 150)];
    }
    const flat: VillageGeo = { ...geo, rotation: 0 };
    const sw = offsetLatLng(flat, -geo.widthM / 2, -heightM / 2);
    const ne = offsetLatLng(flat, geo.widthM / 2, heightM / 2);
    return [sw, ne];
  }, [geo, heightM, showOverlay, hotspots, zones]);


  const selectedSpot = useMemo(
    () => hotspots.find((h) => h.id === selected) ?? null,
    [hotspots, selected],
  );


  // Real facility points only — legacy imports left numeric "tent" points behind,
  // and those belong to the tent layer, not the icon layer.
  const facilitySpots = useMemo(
    () => hotspots.filter((s) => s.title?.trim() && !normalizedNumber(s.title)),
    [hotspots],
  );

  // Match the Weekend Warrior customer map: keep every deliberately drawn area
  // visible as a clean polygon, but hide the old per-tent footprint polygons
  // whose names are only a tent number. Polygon vertices and area names are
  // never rendered on the customer map.
  // Geometry (positions, centroid, footprint bounds) is precomputed inside
  // these memos: after a pan, ViewportWatcher re-renders the tree, and handing
  // react-leaflet fresh arrays makes it redraw every vector layer on the
  // canvas pane — which is the white flash seen on drag release. Stable
  // references mean react-leaflet skips the layers entirely.
  const visibleZones = useMemo(
    () =>
      zones
        .filter((z) => {
          const name = (z.name ?? "").trim();
          const tentFootprint = /^(?:tent\s*)?\d+$/i.test(name);
          if (z.id === highlightZoneId) return !highlightTentId && !tentFootprint;
          return !tentFootprint;
        })
        .map((z) => ({
          zone: z,
          positions: z.points.map((p) => [p.lat, p.lng]) as [number, number][],
          centre: zonesInteractive && hasBuildDetail(z) ? zoneCentroid(z) : null,
        })),
    [zones, highlightZoneId, highlightTentId, zonesInteractive],
  );

  // Only real tent pins reach the rider map. Points flagged as drawing markers
  // (the handles used to shape an area) are never rendered, at any zoom.
  const droppedTents = useMemo(
    () =>
      tents
        .filter((tent) => (tent.kind ?? "tent") !== "marker")
        .map((tent) => {
          const meta = tentTypeMeta(tent.tent_type);
          return {
            tent,
            meta,
            footprint: tentFootprintCorners(tent.lat, tent.lng, meta.sizeM, tent.rotation ?? 0),
            pos: [tent.lat, tent.lng] as [number, number],
            icon: tentIcon(tent.label, false),
          };
        }),
    [tents],
  );

  const labelCandidates = useMemo<LabelCandidate[]>(() => [
    ...facilitySpots.map((spot) => ({
      id: spot.id,
      position: hotspotLatLng(geo, spot, heightM),
      width: Math.min(180, Math.max(58, spot.title.length * 6.2 + 18)),
      priority: CATEGORY_LABEL_PRIORITY[spot.category] ?? (spot.layer === "rider" || !spot.layer ? 55 : 35),
      selected: spot.id === selected,
      kind: "facility" as const,
    })),
    ...visibleZones.flatMap(({ zone, centre }) => centre ? [{
      id: zone.id,
      position: [centre.lat, centre.lng] as [number, number],
      width: Math.min(190, Math.max(64, (zone.name || zoneKindLabel(zone.kind)).length * 6.2 + 20)),
      priority: zone.id === highlightZoneId ? 110 : 42,
      selected: zone.id === highlightZoneId,
      kind: "zone" as const,
    }] : []),
    ...droppedTents.map(({ tent }) => ({
      id: tent.id,
      position: [tent.lat, tent.lng] as [number, number],
      width: Math.min(110, Math.max(34, tent.label.length * 6 + 12)),
      priority: tent.id === highlightTentId ? 120 : 76,
      selected: tent.id === highlightTentId,
      kind: "obstacle" as const,
    })),
  ], [facilitySpots, geo, heightM, selected, visibleZones, highlightZoneId, droppedTents, highlightTentId]);

  const applyLabelLayout = useCallback((nextFacilities: Set<string>, nextZones: Set<string>) => {
    setFacilityLabels(nextFacilities);
    setZoneLabels(nextZones);
  }, []);

  const focusTarget = useMemo<FocusTarget>(() => {
    if (highlightTentId) {
      const tent = droppedTents.find(({ tent: item }) => item.id === highlightTentId)?.tent;
      if (tent) return { key: `tent:${tent.id}`, position: [tent.lat, tent.lng] };
    }
    if (selected) {
      const spot = facilitySpots.find((item) => item.id === selected);
      if (spot) return { key: `spot:${spot.id}`, position: hotspotLatLng(geo, spot, heightM) };
    }
    if (highlightZoneId) {
      const zone = zones.find((item) => item.id === highlightZoneId);
      const centre = zone ? zoneCentroid(zone) : null;
      if (centre) return { key: `zone:${zone?.id}`, position: [centre.lat, centre.lng] };
    }
    return null;
  }, [highlightTentId, droppedTents, selected, facilitySpots, geo, heightM, highlightZoneId, zones]);

  const focusNeighbours = useMemo<[number, number][]>(() => [
    ...facilitySpots.map((spot) => hotspotLatLng(geo, spot, heightM)),
    ...droppedTents.map(({ pos }) => pos),
    ...visibleZones.flatMap(({ centre }) => centre ? [[centre.lat, centre.lng] as [number, number]] : []),
  ], [facilitySpots, geo, heightM, droppedTents, visibleZones]);


  function clearLocation() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setMe(null);
    setAccuracy(null);
    setLocating(false);
    // Fly back to the village so the rider isn't stranded on their location.
    setViewBoundsToken((t) => t + 1);
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setGeoError("Location isn't available on this device.");
      return;
    }
    // Already showing the rider: turn it off and return to the village view.
    if (me) {
      clearLocation();
      return;
    }
    setLocating(true);
    setGeoError(null);
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocating(false);
        setMe([pos.coords.latitude, pos.coords.longitude]);
        setAccuracy(pos.coords.accuracy ?? null);
        setRecenterToken((t) => t + 1);
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — allow location to see yourself on the map."
            : "Couldn't get your location. Try again outdoors.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }

  // Full screen renders through a portal on <body>: inside the page tree any
  // ancestor with a transform/filter turns `fixed` into a normal box, so the
  // "full screen" map stayed the size of its card.
  const shell = (
      <div
        className={
          fullscreen
            ? "fixed inset-0 z-[9999] h-[100dvh] w-screen bg-black"
            : "relative overflow-hidden rounded-2xl ring-1 ring-border"
        }
      >
        <MapContainer
          ref={mapRef}
          center={[geo.lat, geo.lng]}
          zoom={17}
          maxZoom={24}
          scrollWheelZoom={false}
          // Leaflet's keyboard support makes the map container focusable; on
          // mobile that focus makes the browser jump the page when you tap the
          // map. Riders never keyboard-drive it, so switch it off.
          keyboard={false}

          zoomSnap={0}
          zoomDelta={1}
          // Keep Leaflet's zoom transform active during a two-finger gesture.
          // Without it, SVG area outlines hold their old screen position while
          // tiles move, then jump into place only when the fingers are lifted.
          zoomAnimation
          fadeAnimation={false}
          markerZoomAnimation
          bounceAtZoomLimits={false}
          touchZoom
          doubleClickZoom
          // Two-finger twist rotates the map (intuitive on mobile); the ↺ ↻
          // buttons remain as the precise fallback.
          {...({ rotate: true, touchRotate: true, rotateControl: false, bearing: 0 } as object)}
          className={`rce-live-map ${fullscreen ? "h-full w-full" : "h-[65vh] min-h-[340px] w-full"}`}

        >
          <VillageMapTrackpadZoom />
          <VectorMoveSync />

          {satellite ? (
            <TileLayer
              crossOrigin="anonymous"
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={24}
              maxNativeZoom={18}
              keepBuffer={8}
              updateWhenIdle={false}
            />
          ) : (
            <TileLayer
              crossOrigin="anonymous"
              attribution="&copy; OpenStreetMap"
              url="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={24}
              maxNativeZoom={19}
              keepBuffer={8}
              updateWhenIdle={false}
            />
          )}

          {showOverlay && imageUrl ? (
            <>
              <ImageOverlay
                url={imageUrl}
                bounds={bounds}
                opacity={0.95}
                className="rce-village-overlay"
                zIndex={400}
              />
              <RotateOverlay rotation={geo.rotation ?? 0} />
            </>
          ) : null}

          {visibleZones.map(({ zone: z, positions, centre }) => {
            const hot = highlightZoneId === z.id;
            const crewTap = zonesInteractive && hasBuildDetail(z);
            return (
              <Fragment key={z.id}>
                <Polygon
                  positions={positions}
                  interactive={crewTap}
                  eventHandlers={crewTap ? { click: () => onZoneSelect?.(z.id) } : undefined}
                  pathOptions={{
                    color: hot ? "#c8102e" : zoneColor(z),
                    weight: hot ? 4 : 2,
                    fillColor: hot ? "#c8102e" : zoneColor(z),
                    fillOpacity: hot ? 0.45 : 0.18,
                  }}
                />
                {centre && (hot || zoneLabels.has(z.id)) ? (
                  <Marker
                    keyboard={false}
                    autoPanOnFocus={false}
                    position={[centre.lat, centre.lng]}
                    icon={zoneLabelIcon(z, hot)}
                    zIndexOffset={hot ? 800 : 250}
                    eventHandlers={{ click: () => onZoneSelect?.(z.id) }}
                  />
                ) : null}
              </Fragment>
            );
          })}


          <ZoomWatcher onZoom={setZoom} />
          <ViewportWatcher onView={setView} />
          <LabelLayout candidates={labelCandidates} zoom={zoom} onLayout={applyLabelLayout} />

          {/* Dropped tent pins are shown exactly where they were placed. Only
              exact duplicates of the same number are collapsed. */}
          {droppedTents.filter(({ tent: t }, i, all) => {
            const number = normalizedNumber(t.label);
            if (!number || t.id === highlightTentId) return true;
            const firstIdx = all.findIndex(
              ({ tent: o }) => normalizedNumber(o.label) === number && o.id !== highlightTentId,
            );
            return firstIdx === i;
          }).map(({ tent: t, meta, footprint, pos, icon }) => {
            const hot = highlightTentId === t.id;
            // Clean-map rule (Weekend Warrior standard): the fitted Tour de Addo
            // view lands at zoom 19, so ordinary tent pins must stay hidden until
            // the rider deliberately zooms one level closer. No placeholder dots
            // or area-corner labels are rendered. Your own tent stays visible.
            if (!hot && zoom < 20) return null;
            // Villages with hundreds of tents stay smooth because off-screen
            // pins are never mounted.
            if (!hot && !inView(t.lat, t.lng)) return null;

            return (
              <Fragment key={t.id}>
              <Polygon
                positions={footprint}
                pathOptions={{
                  color: hot ? "#c8102e" : meta.id === "luxury" ? "#f59e0b" : "#38bdf8",
                  weight: 1.5,
                  fillOpacity: 0.18,
                  interactive: false,
                }}
              />
              <Marker
                keyboard={false}
                autoPanOnFocus={false}
                position={pos}
                icon={hot ? tentIcon(t.label, true) : icon}
                zIndexOffset={hot ? 900 : 300}
              >
                <Popup autoPan={false} keepInView={false}>
                  {hot ? `${t.label} — this is you` : t.label} · {meta.name} {meta.sizeM}x{meta.sizeM}m
                </Popup>
              </Marker>
              </Fragment>
            );
          })}

          <FocusSelection
            target={focusTarget}
            neighbours={focusNeighbours}
            detailOpen={fullscreen && !!fullscreenDetail}
          />


          <FitBounds bounds={bounds} refitToken={viewBoundsToken} />
          <Recenter position={me} token={recenterToken} />

          {/* Facility points (toilets, chill zone, food…) show as clean icon pucks.
              Tapping one expands its name on the map; tapping again or tapping the
              map clears it. Numeric "tent number" points stay out of this layer. */}
          {facilitySpots.map((spot) => {
            const active = selected === spot.id;
            const pos = hotspotLatLng(geo, spot, heightM);
            if (!active && !inView(pos[0], pos[1])) return null;
            return (
              <Marker
                keyboard={false}
                autoPanOnFocus={false}
                key={`spot-${spot.id}`}
                position={pos}
                icon={facilityIcon(spot, active, active || facilityLabels.has(spot.id))}
                zIndexOffset={active ? 1000 : 400}
                eventHandlers={{ click: () => onSelect(active ? null : spot.id) }}
              />
            );
          })}



          <ClearOnMapClick onClear={() => onSelect(null)} />



          {me ? (
            <>
              {accuracy ? (
                <CircleMarker
                  center={me}
                  radius={Math.min(40, Math.max(12, accuracy / 3))}
                  pathOptions={{ color: "#2563eb", weight: 1, fillColor: "#2563eb", fillOpacity: 0.15 }}
                />
              ) : null}
              <CircleMarker
                center={me}
                radius={7}
                pathOptions={{ color: "#ffffff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}
              >
                <Popup autoPan={false} keepInView={false}>You are here</Popup>
              </CircleMarker>
            </>
          ) : null}

          <BearingSync bearing={bearing} />
          <TwoFingerPanGate fullscreen={fullscreen} onTouch={dismissTwoFingerHint} />
        </MapContainer>

        {!fullscreen && twoFingerHint ? (
          <div className="pointer-events-none absolute inset-0 z-[600] grid place-items-center bg-ink/45 px-6 text-center">
            <p className="rounded-2xl bg-card/95 px-4 py-3 text-sm font-bold text-ink shadow-lg ring-1 ring-border">
              Use two fingers to move the map
            </p>
          </div>
        ) : null}



        <div className="pointer-events-none absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-[500] flex gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit full screen" : "View full screen"}
            className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full bg-card/95 text-ink shadow ring-1 ring-border"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setSatellite((s) => !s)}
            className="pointer-events-auto rounded-full bg-card/95 px-3 py-1.5 text-[11px] font-bold text-ink shadow ring-1 ring-border"
          >
            {satellite ? "Satellite" : "Street"}
          </button>
        </div>

        {fullscreen && fullscreenControls ? (
          <div className="pointer-events-auto absolute left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-[500] max-w-[calc(100vw-10rem)] rounded-lg bg-card/95 p-2 shadow ring-1 ring-border backdrop-blur">
            {fullscreenControls}
          </div>
        ) : null}

        {/* Rotate the map to match the way you're facing. */}
        <div className={`pointer-events-none absolute left-[max(0.75rem,env(safe-area-inset-left))] z-[500] flex items-center gap-1.5 ${fullscreen && fullscreenDetail ? "bottom-[calc(38dvh+0.75rem)]" : "bottom-[max(0.75rem,env(safe-area-inset-bottom))]"}`}>
          <button
            type="button"
            aria-label="Rotate map anti-clockwise"
            onClick={() => setBearing((b) => (b + 345) % 360)}
            className="pointer-events-auto h-9 w-9 rounded-full bg-card/95 text-sm font-bold text-ink shadow ring-1 ring-border"
          >
            ↺
          </button>
          <button
            type="button"
            aria-label="Rotate map clockwise"
            onClick={() => setBearing((b) => (b + 15) % 360)}
            className="pointer-events-auto h-9 w-9 rounded-full bg-card/95 text-sm font-bold text-ink shadow ring-1 ring-border"
          >
            ↻
          </button>
          {bearing !== 0 ? (
            <button
              type="button"
              aria-label="Reset map to north"
              onClick={() => setBearing(0)}
              className="pointer-events-auto rounded-full bg-card/95 px-3 py-1.5 text-[11px] font-bold text-ink shadow ring-1 ring-border"
            >
              North ↑ {Math.round(bearing)}°
            </button>
          ) : null}
        </div>


        <button
          type="button"
          onClick={locate}
          className={`absolute right-[max(0.75rem,env(safe-area-inset-right))] z-[500] rounded-full cherry-gradient px-4 py-2 text-xs font-bold text-white shadow-lg ${fullscreen && fullscreenDetail ? "bottom-[calc(38dvh+0.75rem)]" : "bottom-[max(0.75rem,env(safe-area-inset-bottom))]"}`}
        >
          {locating ? "Finding you…" : me ? "Hide my location" : "Show my location"}
        </button>

        {/* Full-screen detail sheet: docked to the bottom strip, well clear of
            the tapped point, so you can read about it and keep using the map. */}
        {fullscreen && fullscreenDetail ? (
          <div className="absolute inset-x-0 bottom-0 z-[700] mx-auto max-h-[38dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-card/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-border backdrop-blur">
            {fullscreenDetail}
          </div>
        ) : null}
      </div>
  );

  return (
    <div className="space-y-2">
      {fullscreen ? createPortal(shell, document.body) : shell}


      {geoError ? <p className="text-xs font-semibold text-cherry">{geoError}</p> : null}
      {me && accuracy ? (
        <p className="text-xs text-ink-soft">Live location on · accurate to about {Math.round(accuracy)} m.</p>
      ) : (
        <p className="text-xs text-ink-soft">
          Use two fingers to move, pinch to zoom or twist to rotate the map, and tap any marker for details.
        </p>
      )}
    </div>
  );
}
