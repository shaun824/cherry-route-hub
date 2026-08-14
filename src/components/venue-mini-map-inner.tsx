// Client-only Leaflet mini map for a single venue point. Used instead of the
// keyless Google Maps iframe, which often renders "Map data not yet available".
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const pin = L.divIcon({
  className: "rce-venue-pin",
  html: `<div style="background:#e11d48;" class="flex h-7 w-7 items-center justify-center rounded-full text-sm ring-2 ring-white shadow-lg">📍</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export default function VenueMiniMapInner({
  lat,
  lng,
  height = "176px",
  zoom = 15,
}: {
  lat: number;
  lng: number;
  height?: string;
  zoom?: number;
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
      maxZoom={24}
      scrollWheelZoom={false}
      dragging={false}
      doubleClickZoom={false}
      zoomControl={false}
      attributionControl={false}
      style={{ height, width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={24}
        maxNativeZoom={19}
      />
      <Marker position={[lat, lng]} icon={pin} />
    </MapContainer>
  );
}
