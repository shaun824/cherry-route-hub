// Leaflet map for the admin route-points editor. Browser-only — lazy-loaded.
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLngAlt } from "@/lib/geo";

export type EditorPoint = {
  key: string;
  name: string;
  icon: string;
  lat: number;
  lng: number;
};

export type EditorLine = { routeId: string; color: string; lines: LatLngAlt[][] };

const GLYPH: Record<string, string> = {
  water: "💧", warning: "🦺", aid: "✚", food: "🍌", start: "🚩", finish: "🏁", photo: "📷", pin: "📍",
};

function icon(p: EditorPoint, selected: boolean) {
  const ring = selected ? "box-shadow:0 0 0 4px #e11d48;" : "box-shadow:0 2px 6px rgba(0,0,0,.35);";
  const bg = p.icon === "water" ? "#0284c7" : p.icon === "warning" ? "#f59e0b" : "#334155";
  return L.divIcon({
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<div style="width:34px;height:34px;border-radius:50%;background:${bg};border:3px solid #fff;${ring}display:grid;place-items:center;font-size:16px;cursor:grab">${GLYPH[p.icon] ?? "📍"}</div>`,
  });
}

export default function RoutePointsEditorMap({
  lines,
  points,
  selectedKey,
  placing,
  onSelect,
  onMove,
  onPlace,
  editLines,
  editColor = "#e11d48",
  selectedVertex,
  onVertexSelect,
  onLinesChange,
}: {
  lines: EditorLine[];
  points: EditorPoint[];
  selectedKey: string | null;
  placing: boolean;
  onSelect: (key: string | null) => void;
  onMove: (key: string, lat: number, lng: number) => void;
  onPlace: (lat: number, lng: number) => void;
  /** Route-line editing: the route's lines, with draggable vertices when zoomed in. */
  editLines?: LatLngAlt[][] | null;
  editColor?: string;
  selectedVertex?: [number, number] | null;
  onVertexSelect?: (v: [number, number] | null) => void;
  onLinesChange?: (lines: LatLngAlt[][]) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const lineLayer = useRef<L.LayerGroup | null>(null);
  const pointLayer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef("");
  const cb = useRef({ onSelect, onMove, onPlace, placing });
  cb.current = { onSelect, onMove, onPlace, placing };
  const editLayer = useRef<L.LayerGroup | null>(null);
  const [view, setView] = useState(0);
  const ecb = useRef({ editLines, onVertexSelect, onLinesChange });
  ecb.current = { editLines, onVertexSelect, onLinesChange };

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = L.map(el.current, { zoomControl: true }).setView([-33.95, 18.9], 12);
    const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" });
    const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri" });
    street.addTo(map);
    L.control.layers({ Street: street, Satellite: sat }, {}, { position: "topright" }).addTo(map);
    lineLayer.current = L.layerGroup().addTo(map);
    editLayer.current = L.layerGroup().addTo(map);
    pointLayer.current = L.layerGroup().addTo(map);
    map.on("moveend zoomend", () => setView((v) => v + 1));
    map.on("click", (e) => {
      if (cb.current.placing) cb.current.onPlace(e.latlng.lat, e.latlng.lng);
      else cb.current.onSelect(null);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getContainer().style.cursor = placing ? "crosshair" : "";
  }, [placing]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = lineLayer.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const all: L.LatLngExpression[] = [];
    for (const l of lines) {
      for (const line of l.lines) {
        const ll = line.map((c) => [c[1], c[0]] as [number, number]);
        all.push(...ll);
        L.polyline(ll, { color: l.color, weight: 5, opacity: 0.9 }).addTo(layer);
      }
    }
    const sig = lines.map((l) => l.routeId).join(",");
    if (all.length && fitted.current !== sig) {
      map.fitBounds(L.latLngBounds(all), { padding: [30, 30] });
      fitted.current = sig;
    }
  }, [lines]);

  useEffect(() => {
    const layer = pointLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const p of points) {
      const m = L.marker([p.lat, p.lng], { icon: icon(p, p.key === selectedKey), draggable: true, title: p.name });
      m.bindTooltip(p.name, { direction: "top", offset: [0, -16] });
      m.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        cb.current.onSelect(p.key);
      });
      m.on("dragend", () => {
        const ll = m.getLatLng();
        cb.current.onMove(p.key, ll.lat, ll.lng);
      });
      m.addTo(layer);
    }
  }, [points, selectedKey]);

  // Route line editing: line is clickable (adds a bend point), vertices draggable at zoom >= 15.
  useEffect(() => {
    const map = mapRef.current;
    const layer = editLayer.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!editLines) return;
    const zoomedIn = map.getZoom() >= 15;
    const b = map.getBounds().pad(0.2);
    editLines.forEach((line, li) => {
      const ll = line.map((c) => [c[1], c[0]] as [number, number]);
      const pl = L.polyline(ll, { color: editColor, weight: 7, opacity: 0.95 }).addTo(layer);
      pl.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (!zoomedIn) return map.setView(e.latlng, 16);
        // insert the new vertex into the nearest segment
        const p = map.latLngToLayerPoint(e.latlng);
        let best = 0, bestD = Infinity;
        for (let i = 0; i < ll.length - 1; i++) {
          const d = L.LineUtil.pointToSegmentDistance(p, map.latLngToLayerPoint(ll[i]!), map.latLngToLayerPoint(ll[i + 1]!));
          if (d < bestD) { bestD = d; best = i; }
        }
        const a = line[best]!, c = line[best + 1] ?? a;
        const alt = a[2] != null && c[2] != null ? (a[2] + c[2]) / 2 : a[2];
        const next = ecb.current.editLines!.map((l) => l.slice());
        next[li]!.splice(best + 1, 0, [+e.latlng.lng.toFixed(7), +e.latlng.lat.toFixed(7), alt]);
        ecb.current.onLinesChange?.(next);
        ecb.current.onVertexSelect?.([li, best + 1]);
      });
      if (!zoomedIn) return;
      line.forEach((c, vi) => {
        if (!b.contains([c[1], c[0]])) return;
        const sel = selectedVertex?.[0] === li && selectedVertex?.[1] === vi;
        const m = L.marker([c[1], c[0]], {
          draggable: true,
          icon: L.divIcon({
            className: "",
            iconSize: [16, 16],
            iconAnchor: [8, 8],
            html: `<div style="width:16px;height:16px;border-radius:50%;background:${sel ? "#e11d48" : "#fff"};border:3px solid ${editColor};cursor:grab"></div>`,
          }),
        }).addTo(layer);
        m.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          ecb.current.onVertexSelect?.([li, vi]);
        });
        m.on("dragend", () => {
          const p = m.getLatLng();
          const next = ecb.current.editLines!.map((l) => l.slice());
          next[li]![vi] = [+p.lng.toFixed(7), +p.lat.toFixed(7), c[2]];
          ecb.current.onLinesChange?.(next);
          ecb.current.onVertexSelect?.([li, vi]);
        });
      });
    });
  }, [editLines, editColor, selectedVertex, view]);

  return <div ref={el} className="h-full w-full" />;
}
