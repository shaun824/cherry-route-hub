// Client-only Leaflet view of the event village: the plan image is placed over
// a satellite basemap at its real-world position, hotspots become map markers
// and the rider's live GPS position is shown as a pulsing dot.
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, ImageOverlay, useMap, CircleMarker, Polygon, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { spotColor, spotIcon, categoryMeta, type VillageGeo, type VillageHotspot } from "@/lib/village-map";
import { villageIconSvg } from "@/lib/village-icons";
import { formatArea, zoneAreaM2, zoneColor, type VillageZone } from "@/lib/village-zones";

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
    map.on("zoomend moveend", apply);
    return () => {
      map.off("zoomend moveend", apply);
    };
  }, [map, rotation]);
  return null;
}

function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [20, 20] });
  }, [map, bounds]);
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

function clusterIcon(cluster: { getChildCount: () => number }) {
  const n = cluster.getChildCount();
  const size = n < 10 ? 34 : n < 25 ? 40 : 46;
  return L.divIcon({
    className: "rce-village-cluster",
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:hsl(var(--cherry,352 82% 47%),1);background:#c8102e;color:#fff;font-weight:800;font-size:13px;border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35)">${n}</div>`,
    iconSize: [size, size],
  });
}

/** Groups nearby hotspot pins; clicking a group spiderfies it so each point is tappable. */
function ClusteredHotspots({
  hotspots,
  geo,
  heightM,
  selected,
  onSelect,
}: {
  hotspots: VillageHotspot[];
  geo: VillageGeo;
  heightM: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const map = useMap();
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    const group = (L as any).markerClusterGroup({
      maxClusterRadius: 44,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: false,
      spiderfyOnMaxZoom: true,
      spiderfyDistanceMultiplier: 1.6,
      iconCreateFunction: clusterIcon,
    });

    for (const s of hotspots) {
      const meta = categoryMeta(s.category);
      const marker = L.marker(hotspotLatLng(geo, s, heightM), {
        icon: pinIcon(spotColor(s), s.title, selected === s.id, spotIcon(s)),
      });
      marker.bindPopup(
        `<strong>${escapeHtml(s.title)}</strong><br/><span style="font-size:11px;text-transform:uppercase;letter-spacing:1px">${escapeHtml(
          meta.label,
        )}${s.hours ? ` · ${escapeHtml(s.hours)}` : ""}</span>${
          s.description ? `<p style="margin-top:6px">${escapeHtml(s.description)}</p>` : ""
        }`,
      );
      marker.on("click", () => selectRef.current(selected === s.id ? null : s.id));
      group.addLayer(marker);
    }

    // Always expand a group on tap instead of only zooming in.
    group.on("clusterclick", (e: any) => e.layer.spiderfy());
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  }, [map, hotspots, geo, heightM, selected]);

  return null;
}


export default function VillageMapGeo({
  imageUrl,
  geo,
  hotspots,
  zones = [],
  selected,
  onSelect,
}: {
  imageUrl?: string | null;
  geo: VillageGeo;
  hotspots: VillageHotspot[];
  zones?: VillageZone[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [ratio, setRatio] = useState(0.76); // height / width, refined once the image loads
  const [me, setMe] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [recenterToken, setRecenterToken] = useState(0);
  const [satellite, setSatellite] = useState(true);
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

  const showOverlay = !!imageUrl && (geo.widthM ?? 0) > 0;
  const heightM = (geo.widthM || 300) * ratio;
  const bounds = useMemo<L.LatLngBoundsExpression>(() => {
    if (!showOverlay) {
      const pts = hotspots
        .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
        .map((s) => [s.lat as number, s.lng as number] as [number, number]);
      if (pts.length > 0) return L.latLngBounds(pts).pad(0.25);
      const flat: VillageGeo = { ...geo, rotation: 0, widthM: 300 };
      return [offsetLatLng(flat, -150, -150), offsetLatLng(flat, 150, 150)];
    }
    const flat: VillageGeo = { ...geo, rotation: 0 };
    const sw = offsetLatLng(flat, -geo.widthM / 2, -heightM / 2);
    const ne = offsetLatLng(flat, geo.widthM / 2, heightM / 2);
    return [sw, ne];
  }, [geo, heightM, showOverlay, hotspots]);



  function locate() {
    if (!("geolocation" in navigator)) {
      setGeoError("Location isn't available on this device.");
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

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-border">
        <MapContainer
          center={[geo.lat, geo.lng]}
          zoom={17}
          scrollWheelZoom
          zoomSnap={0.25}
          zoomDelta={0.5}
          wheelPxPerZoomLevel={140}
          className="h-[65vh] min-h-[340px] w-full"
        >
          {satellite ? (
            <TileLayer
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={21}
              maxNativeZoom={19}
            />
          ) : (
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={21}
              maxNativeZoom={19}
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

          {zones.map((z) => (
            <Polygon
              key={z.id}
              positions={z.points.map((p) => [p.lat, p.lng]) as [number, number][]}
              pathOptions={{ color: zoneColor(z), weight: 2, fillColor: zoneColor(z), fillOpacity: 0.18 }}
            >
              <Tooltip direction="center" permanent className="rce-zone-label">
                <span style={{ fontWeight: 800 }}>{z.name}</span>
                <br />
                {formatArea(zoneAreaM2(z))}
              </Tooltip>
            </Polygon>
          ))}

          <FitBounds bounds={bounds} />
          <Recenter position={me} token={recenterToken} />

          <ClusteredHotspots
            hotspots={hotspots}
            geo={geo}
            heightM={heightM}
            selected={selected}
            onSelect={onSelect}
          />


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
                <Popup>You are here</Popup>
              </CircleMarker>
            </>
          ) : null}
        </MapContainer>

        <div className="pointer-events-none absolute right-3 top-3 z-[500] flex gap-2">
          <button
            type="button"
            onClick={() => setSatellite((s) => !s)}
            className="pointer-events-auto rounded-full bg-card/95 px-3 py-1.5 text-[11px] font-bold text-ink shadow ring-1 ring-border"
          >
            {satellite ? "Satellite" : "Street"}
          </button>
        </div>

        <button
          type="button"
          onClick={locate}
          className="absolute bottom-3 right-3 z-[500] rounded-full cherry-gradient px-4 py-2 text-xs font-bold text-white shadow-lg"
        >
          {locating ? "Finding you…" : me ? "Recentre on me" : "Show my location"}
        </button>
      </div>

      {geoError ? <p className="text-xs font-semibold text-cherry">{geoError}</p> : null}
      {me && accuracy ? (
        <p className="text-xs text-ink-soft">Live location on · accurate to about {Math.round(accuracy)} m.</p>
      ) : (
        <p className="text-xs text-ink-soft">
          Drag to move, pinch or scroll to zoom, and tap any marker for details.
        </p>
      )}
    </div>
  );
}
