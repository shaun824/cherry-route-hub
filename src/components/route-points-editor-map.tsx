// Leaflet map for the admin route-points editor. Browser-only — lazy-loaded.
import { useEffect, useRef } from "react";
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
}: {
  lines: EditorLine[];
  points: EditorPoint[];
  selectedKey: string | null;
  placing: boolean;
  onSelect: (key: string | null) => void;
  onMove: (key: string, lat: number, lng: number) => void;
  onPlace: (lat: number, lng: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const lineLayer = useRef<L.LayerGroup | null>(null);
  const pointLayer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef("");
  const cb = useRef({ onSelect, onMove, onPlace, placing });
  cb.current = { onSelect, onMove, onPlace, placing };

  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = L.map(el.current, { zoomControl: true }).setView([-33.95, 18.9], 12);
    const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" });
    const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Esri" });
    street.addTo(map);
    L.control.layers({ Street: street, Satellite: sat }, {}, { position: "topright" }).addTo(map);
    lineLayer.current = L.layerGroup().addTo(map);
    pointLayer.current = L.layerGroup().addTo(map);
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

  return <div ref={el} className="h-full w-full" />;
}
