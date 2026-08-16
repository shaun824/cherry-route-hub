// Client-only Leaflet view of the event village: the plan image is placed over
// a satellite basemap at its real-world position, hotspots become map markers
// and the rider's live GPS position is shown as a pulsing dot.
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, ImageOverlay, useMap, CircleMarker, Polygon, Popup, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { VillageGeo, VillageHotspot } from "@/lib/village-map";
import { spotColor, spotIcon } from "@/lib/village-map";
import { villageIconSvg } from "@/lib/village-icons";
import { zoneCentroid, zoneColor, type VillageZone } from "@/lib/village-zones";

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
    // Cap at the highest zoom the satellite imagery actually covers, otherwise
    // the map opens on upscaled/blank tiles.
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 19 });
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


/** Flies to a drawn area when a rider asks "where is my tent?". */
function FlyToZone({ zone }: { zone: VillageZone | null }) {
  const map = useMap();
  useEffect(() => {
    if (!zone) return;
    const c = zoneCentroid(zone);
    if (c) map.flyTo([c.lat, c.lng], Math.max(map.getZoom(), 19), { duration: 0.8 });
  }, [map, zone]);
  return null;
}

/** Flies straight to an exact tent pin — the tightest "this is your tent" view. */
function FlyToTent({ tent }: { tent: MapTent | null }) {
  const map = useMap();
  useEffect(() => {
    if (!tent) return;
    map.flyTo([tent.lat, tent.lng], Math.max(map.getZoom(), 21), { duration: 0.9 });
  }, [map, tent]);
  return null;
}

export type MapTent = { id: string; label: string; lat: number; lng: number };

/** Label pin shown for whichever facility/point the rider currently has selected. */
function pointLabelIcon(label: string) {
  return L.divIcon({
    className: "rce-village-point",
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <span style="background:#0f172a;color:#fff;font-size:11px;font-weight:800;padding:3px 8px;border-radius:8px;white-space:nowrap;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)">${escapeHtml(
        label,
      )}</span>
      <span style="width:8px;height:8px;background:#0f172a;transform:rotate(45deg) translateY(-3px);border-radius:1px;border-right:2px solid #fff;border-bottom:2px solid #fff"></span>
    </div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 18],
  });
}

/** Flies to the selected point so its label is actually in view. */
function FlyToPoint({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, Math.max(map.getZoom(), 19), { duration: 0.7 });
  }, [map, position]);
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
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [map, onZoom]);
  return null;
}

/** Compact dot used for tents when zoomed out, so the village doesn't turn into a wall of numbers. */
function tentDotIcon(active: boolean) {
  const bg = active ? "#c8102e" : "#1f2937";
  return L.divIcon({
    className: "rce-village-tent-dot",
    html: `<div style="width:9px;height:9px;border-radius:999px;background:${bg};border:1.5px solid rgba(255,255,255,.85);box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
    iconSize: [9, 9],
    iconAnchor: [4.5, 4.5],
  });
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

function areaNumberIcon(label: string, active: boolean) {
  const bg = active ? "#c8102e" : "#1f2937";
  return L.divIcon({
    className: "rce-village-area-number",
    html: `<span style="display:grid;min-width:22px;height:22px;place-items:center;border-radius:6px;background:${bg};color:#fff;font-size:10px;font-weight:800;border:${
      active ? "2px solid #fff" : "1px solid rgba(255,255,255,.65)"
    };box-shadow:0 1px 4px rgba(0,0,0,.35)">${escapeHtml(label)}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
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

  highlightZoneId = null,
  highlightTentId = null,
}: {
  imageUrl?: string | null;
  geo: VillageGeo;
  hotspots: VillageHotspot[];
  zones?: VillageZone[];
  tents?: MapTent[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  highlightZoneId?: string | null;
  highlightTentId?: string | null;
}) {

  const [ratio, setRatio] = useState(0.76); // height / width, refined once the image loads
  const [me, setMe] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [recenterToken, setRecenterToken] = useState(0);
  const [satellite, setSatellite] = useState(true);
  const [zoom, setZoom] = useState(17);
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

  // Older village-map imports created a separate tent pin for every numbered
  // drawn area. Those pins landed near area corners and made the rider map look
  // like it was showing polygon handles. Use one label at each area's centre
  // instead; genuine standalone/manual tent pins remain visible below.
  const numberedAreas = useMemo(() => {
    const seen = new Set<string>();
    return zones.flatMap((zone) => {
      const number = normalizedNumber(zone.name);
      const centre = zoneCentroid(zone);
      if (!number || !centre || seen.has(number)) return [];
      seen.add(number);
      return [{ zone, number, centre }];
    });
  }, [zones]);
  const numberedAreaLabels = useMemo(
    () => new Set(numberedAreas.map((area) => area.number)),
    [numberedAreas],
  );



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
          maxZoom={24}
          scrollWheelZoom
          zoomSnap={0}
          zoomDelta={0.35}
          wheelPxPerZoomLevel={220}
          zoomAnimation
          markerZoomAnimation
          bounceAtZoomLimits={false}
          touchZoom
          doubleClickZoom
          className="h-[65vh] min-h-[340px] w-full"
        >
          {satellite ? (
            <TileLayer
              crossOrigin="anonymous"
              attribution="Tiles &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={24}
              maxNativeZoom={18}
            />
          ) : (
            <TileLayer
              crossOrigin="anonymous"
              attribution="&copy; OpenStreetMap"
              url="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={24}
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

          {zones.map((z) => {
            const hot = highlightZoneId === z.id;
            return (
              <Polygon
                key={z.id}
                positions={z.points.map((p) => [p.lat, p.lng]) as [number, number][]}
                pathOptions={{
                  color: hot ? "#c8102e" : zoneColor(z),
                  weight: hot ? 4 : 2,
                  fillColor: hot ? "#c8102e" : zoneColor(z),
                  fillOpacity: hot ? 0.45 : 0.18,
                }}
              >
                {z.name ? <Popup>{z.name}</Popup> : null}
              </Polygon>
            );
          })}

          <ZoomWatcher onZoom={setZoom} />

          {numberedAreas.map(({ zone, number, centre }) => {
            const active = highlightZoneId === zone.id;
            if (!active && zoom < 19) return null;
            return (
              <Marker
                key={`area-label-${zone.id}`}
                position={[centre.lat, centre.lng]}
                icon={areaNumberIcon(number, active)}
                interactive={false}
                keyboard={false}
                zIndexOffset={active ? 850 : 200}
              />
            );
          })}

          {tents.filter((t) => {
            const number = normalizedNumber(t.label);
            return t.id === highlightTentId || !number || !numberedAreaLabels.has(number);
          }).map((t) => {
            const hot = highlightTentId === t.id;
            // Labels only once you're zoomed in — otherwise the numbers overlap
            // into an unreadable block. Your own tent always stays labelled.
            const labelled = hot || zoom >= 19;
            return (
              <Marker
                key={t.id}
                position={[t.lat, t.lng]}
                icon={labelled ? tentIcon(t.label, hot) : tentDotIcon(hot)}
                zIndexOffset={hot ? 900 : 300}
              >
                <Popup>{hot ? `${t.label} — this is you` : t.label}</Popup>
              </Marker>
            );
          })}

          <FlyToTent tent={tents.find((t) => t.id === highlightTentId) ?? null} />
          <FlyToZone
            zone={highlightTentId ? null : zones.find((z) => z.id === highlightZoneId) ?? null}
          />


          <FitBounds bounds={bounds} />
          <Recenter position={me} token={recenterToken} />

          {/* Facility hotspots are intentionally NOT drawn on the map — riders asked
              for a clean plan where the only pins are the tents. The one exception is
              the point you've currently selected, which gets a name label until you tap away. */}
          {selectedSpot ? (
            <Marker
              position={hotspotLatLng(geo, selectedSpot, heightM)}
              icon={pointLabelIcon(selectedSpot.title)}
              zIndexOffset={1000}
              eventHandlers={{ click: () => onSelect(null) }}
            />
          ) : null}
          <FlyToPoint
            position={selectedSpot ? hotspotLatLng(geo, selectedSpot, heightM) : null}
          />
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
