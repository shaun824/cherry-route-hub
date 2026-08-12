// Client-only Leaflet editor: place and drag village points straight onto a
// satellite map of the venue — no plan image required.
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { spotColor, spotIcon, type VillageHotspot } from "@/lib/village-map";
import { villageIconSvg } from "@/lib/village-icons";

function pinIcon(color: string, label: string, active: boolean, iconId?: string) {
  return L.divIcon({
    className: "rce-village-pin",
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-6px)">
      <span style="display:inline-flex;align-items:center;gap:4px;background:${color};color:#fff;font-size:10px;font-weight:800;padding:3px 7px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.35);border:${
        active ? "2px solid #fff" : "1px solid rgba(255,255,255,.5)"
      }">${villageIconSvg(iconId)}${label}</span>
      <span style="width:8px;height:8px;background:${color};transform:rotate(45deg) translateY(-3px);border-radius:2px"></span>
    </div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 18],
  });
}

function ClickCatcher({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Centre({ lat, lng, token }: { lat: number; lng: number; token: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 17));
  }, [map, lat, lng, token]);
  return null;
}

export default function VillageMapEditorGeo({
  centre,
  centreToken,
  hotspots,
  selected,
  placing,
  onPlace,
  onMove,
  onSelect,
}: {
  centre: { lat: number; lng: number };
  centreToken: number;
  hotspots: VillageHotspot[];
  selected: string | null;
  placing: boolean;
  onPlace: (lat: number, lng: number) => void;
  onMove: (id: string, lat: number, lng: number) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl ring-1 ring-border ${placing ? "cursor-crosshair" : ""}`}>
      <MapContainer
        center={[centre.lat, centre.lng]}
        zoom={17}
        scrollWheelZoom
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={140}
        className="h-[65vh] min-h-[360px] w-full"
      >
        <TileLayer
          attribution="Tiles &copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={21}
          maxNativeZoom={19}
        />
        <Centre lat={centre.lat} lng={centre.lng} token={centreToken} />
        {placing ? <ClickCatcher onClick={onPlace} /> : null}

        {hotspots
          .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
          .map((s) => {
            const meta = categoryMeta(s.category);
            return (
              <Marker
                key={s.id}
                position={[s.lat as number, s.lng as number]}
                draggable
                icon={pinIcon(spotColor(s), s.title, selected === s.id, spotIcon(s))}
                eventHandlers={{
                  click: () => onSelect(s.id),
                  dragend: (e) => {
                    const { lat, lng } = (e.target as L.Marker).getLatLng();
                    onMove(s.id, +lat.toFixed(6), +lng.toFixed(6));
                  },
                }}
              />
            );
          })}
      </MapContainer>
    </div>
  );
}
