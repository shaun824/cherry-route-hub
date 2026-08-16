// Client-only Leaflet editor: place and drag village points straight onto a
// satellite map of the venue — no plan image required. Also supports drawing
// measured areas (zones) so the field layout can be planned to the metre.
import { Fragment, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polygon, Polyline, Popup, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { spotColor, spotIcon, type VillageHotspot } from "@/lib/village-map";
import { villageIconSvg } from "@/lib/village-icons";
import {
  distanceM,
  formatLength,
  moveZone,
  zoneCentroid,
  zoneColor,
  zonePerimeterM,
  type VillageZone,
  type ZonePoint,
} from "@/lib/village-zones";

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

function handleIcon(color: string, size = 12) {
  return L.divIcon({
    className: "rce-zone-handle",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:999px;background:#fff;border:3px solid ${color};box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function moveIcon(color: string) {
  return L.divIcon({
    className: "rce-zone-move",
    html: `<span style="display:grid;place-items:center;width:22px;height:22px;border-radius:999px;background:${color};color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);font-size:12px;font-weight:900">✥</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
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

function MouseTracker({ onMove }: { onMove: (p: ZonePoint) => void }) {
  useMapEvents({
    mousemove(e) {
      onMove({ lat: e.latlng.lat, lng: e.latlng.lng });
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

// Frames all drawn areas / pins on first load so tiny tent clusters aren't a
// 5px dot you can't tap.
function FitToContent({ points, token }: { points: ZonePoint[]; token: number }) {
  const map = useMap();
  const fittedFor = useRef<number | null>(null);
  useEffect(() => {
    if (points.length === 0) return;
    if (fittedFor.current === token) return;
    fittedFor.current = token;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.4), { maxZoom: 21 });
  }, [map, token, points]);
  return null;
}



function tentPinIcon(label: string, active: boolean, marker = false) {
  const bg = active ? "#c8102e" : marker ? "#64748b" : "#111827";
  const safe = label.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
  return L.divIcon({
    className: "rce-village-tent",
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <span style="background:${bg};color:#fff;font-size:10px;font-weight:800;padding:2px 6px;border-radius:6px;white-space:nowrap;border:${
        active ? "2px solid #fff" : "1px solid rgba(255,255,255,.6)"
      };box-shadow:0 2px 6px rgba(0,0,0,.35);opacity:${marker ? 0.75 : 1}">${marker ? "◇ " : ""}${safe}</span>
      <span style="width:6px;height:6px;background:${bg};transform:rotate(45deg) translateY(-2px);border-radius:1px"></span>
    </div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 14],
  });
}

function MapDeleteBubble({
  label,
  onDelete,
  onToggleKind,
  isMarker,
}: {
  label: string;
  onDelete: () => void;
  onToggleKind?: () => void;
  isMarker?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-bold text-ink">{label}</span>
      {onToggleKind ? (
        <button
          type="button"
          onClick={onToggleKind}
          className="rounded-lg bg-muted px-2 py-1 text-[11px] font-bold text-ink"
        >
          {isMarker ? "Make tent number" : "Make area marker"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          if (confirm(`Delete ${label} from the map?`)) onDelete();
        }}
        className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-bold text-white"
      >
        Delete
      </button>
    </div>
  );
}

export default function VillageMapEditorGeo({
  centre,
  centreToken,
  hotspots,
  selected,
  placing,
  drawing,
  zones,
  selectedZone,
  overlapping,
  onPlace,
  onMove,
  onSelect,
  onDrawn,
  onCancelDraw,
  onCancelPlace,
  onZoneChange,
  onSelectZone,
  onRenameZone,
  onDuplicateZone,
  tents = [],
  tentMode = false,
  onPlaceTent,
  onMoveTent,
  onSelectTent,
  selectedTent = null,
  onDeleteTent,
  onToggleTentKind,
  onDeleteHotspot,
}: {
  centre: { lat: number; lng: number };
  centreToken: number;
  hotspots: VillageHotspot[];
  selected: string | null;
  placing: boolean;
  drawing: boolean;
  zones: VillageZone[];
  selectedZone: string | null;
  overlapping: Set<string>;
  onPlace: (lat: number, lng: number) => void;
  onMove: (id: string, lat: number, lng: number) => void;
  onSelect: (id: string) => void;
  onDrawn: (points: ZonePoint[]) => void;
  onCancelDraw: () => void;
  onCancelPlace?: () => void;
  onZoneChange: (id: string, points: ZonePoint[]) => void;
  onSelectZone: (id: string | null) => void;
  onRenameZone?: (id: string, name: string) => void;
  onDuplicateZone?: (id: string) => void;
  tents?: { id: string; label: string; lat: number; lng: number; kind?: "tent" | "marker" | null }[];
  tentMode?: boolean;
  onPlaceTent?: (lat: number, lng: number) => void;
  onMoveTent?: (id: string, lat: number, lng: number) => void;
  onSelectTent?: (id: string | null) => void;
  selectedTent?: string | null;
  onDeleteTent?: (id: string) => void;
  onToggleTentKind?: (id: string) => void;
  onDeleteHotspot?: (id: string) => void;
}) {
  const [draft, setDraft] = useState<ZonePoint[]>([]);
  const [cursor, setCursor] = useState<ZonePoint | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [fitToken, setFitToken] = useState(0);
  const activeZone = zones.find((z) => z.id === selectedZone) ?? null;

  const contentPoints: ZonePoint[] = [
    ...zones.flatMap((z) => z.points),
    ...hotspots
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .map((s) => ({ lat: s.lat as number, lng: s.lng as number })),
  ];

  useEffect(() => {
    if (!drawing) {
      setDraft([]);
      setCursor(null);
    }
  }, [drawing]);

  const locked = placing || drawing || tentMode;

  // Editing areas is disabled in add-pin / draw modes — drop any selection.
  useEffect(() => {
    if (locked && selectedZone) onSelectZone(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  const draftPreview = cursor && draft.length > 0 ? [...draft, cursor] : draft;
  const liveEdge =
    cursor && draft.length > 0 ? distanceM(draft[draft.length - 1], cursor) : 0;


  return (
    <div className="relative">
      <div
        className={`overflow-hidden rounded-2xl ring-1 ring-border ${
          placing || drawing || tentMode ? "cursor-crosshair" : ""
        }`}
      >
        <MapContainer
          center={[centre.lat, centre.lng]}
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
          className="h-[65vh] min-h-[360px] w-full"
        >
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={24}
            maxNativeZoom={18}
          />
          <Centre lat={centre.lat} lng={centre.lng} token={centreToken} />
          <FitToContent points={contentPoints} token={fitToken} />

          {placing ? <ClickCatcher onClick={onPlace} /> : null}
          {tentMode && onPlaceTent ? <ClickCatcher onClick={onPlaceTent} /> : null}

          {tents.map((t) => (
            <Marker
              key={t.id}
              position={[t.lat, t.lng]}
              draggable={!locked}
              icon={tentPinIcon(t.label, selectedTent === t.id, t.kind === "marker")}
              eventHandlers={{
                click: () => onSelectTent?.(selectedTent === t.id ? null : t.id),
                dragend: (e) => {
                  const ll = (e.target as L.Marker).getLatLng();
                  onMoveTent?.(t.id, ll.lat, ll.lng);
                },
              }}
            >
              {onDeleteTent && !locked ? (
                <Popup autoPan={false} closeButton={false}>
                  <MapDeleteBubble
                    label={t.kind === "marker" ? `Area marker ${t.label}` : `Tent ${t.label}`}
                    isMarker={t.kind === "marker"}
                    onToggleKind={onToggleTentKind ? () => onToggleTentKind(t.id) : undefined}
                    onDelete={() => onDeleteTent(t.id)}
                  />
                </Popup>
              ) : null}
            </Marker>
          ))}
          {drawing ? (
            <>
              <ClickCatcher onClick={(lat, lng) => setDraft((d) => [...d, { lat, lng }])} />
              <MouseTracker onMove={setCursor} />
            </>
          ) : null}

          {/* saved zones */}
          {zones.map((z) => {
            const active = selectedZone === z.id && !locked;
            const clash = overlapping.has(z.id);
            const c = zoneCentroid(z);
            return (
              <Fragment key={z.id}>
                {active ? (
                  <Polygon
                    positions={z.points.map((p) => [p.lat, p.lng]) as [number, number][]}
                    interactive={false}
                    pathOptions={{
                      color: "#ffffff",
                      weight: 10,
                      opacity: 0.85,
                      fill: false,
                      className: "rce-zone-halo",
                    }}
                  />
                ) : null}
                <Polygon
                  positions={z.points.map((p) => [p.lat, p.lng]) as [number, number][]}
                  interactive={!placing && !drawing}
                  bubblingMouseEvents={false}
                  pathOptions={{
                    color: clash ? "#dc2626" : active ? "#111827" : zoneColor(z),
                    weight: active ? 5 : 2,
                    dashArray: clash ? "6 4" : active ? "10 6" : undefined,
                    fillColor: zoneColor(z),
                    fillOpacity: active ? 0.45 : 0.18,
                    className: active ? "rce-zone-selected" : undefined,
                  }}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e as unknown as Event);
                      if (placing || drawing) return;
                      onSelectZone(z.id);
                    },
                  }}
                >
                  {showLabels || active ? (
                    <Tooltip
                      direction="center"
                      permanent
                      interactive={false}
                      className={active ? "rce-zone-label rce-zone-label-active" : "rce-zone-label"}
                    >
                      <span style={{ fontWeight: 800 }}>{z.name}</span>
                      {active ? <span style={{ display: "block", fontSize: 10, opacity: 0.9 }}>Selected — editable</span> : null}
                    </Tooltip>
                  ) : null}
                </Polygon>

                {/* invisible fat hitbox so small zones stay tappable */}
                {!locked ? (
                  <Polygon
                    positions={z.points.map((p) => [p.lat, p.lng]) as [number, number][]}
                    interactive
                    bubblingMouseEvents={false}
                    pathOptions={{
                      color: "#000",
                      weight: 26,
                      opacity: 0,
                      fillOpacity: 0,
                      className: "rce-zone-hit",
                    }}
                    eventHandlers={{
                      click: (e) => {
                        L.DomEvent.stopPropagation(e as unknown as Event);
                        onSelectZone(z.id);
                      },
                    }}
                  />
                ) : null}



                {active && c ? (
                  <>
                    <Marker
                      position={[c.lat, c.lng]}
                      icon={moveIcon(zoneColor(z))}
                      draggable
                      eventHandlers={{
                        dragend: (e) => {
                          const ll = (e.target as L.Marker).getLatLng();
                          onZoneChange(z.id, moveZone(z, { lat: ll.lat, lng: ll.lng }).points);
                        },
                      }}
                    />
                    {z.points.map((p, i) => (
                      <Marker
                        key={`${z.id}-v${i}`}
                        position={[p.lat, p.lng]}
                        icon={handleIcon(zoneColor(z))}
                        draggable
                        eventHandlers={{
                          drag: (e) => {
                            const ll = (e.target as L.Marker).getLatLng();
                            const next = z.points.map((q, j) =>
                              j === i ? { lat: +ll.lat.toFixed(7), lng: +ll.lng.toFixed(7) } : q,
                            );
                            onZoneChange(z.id, next);
                          },
                          dblclick: () => {
                            if (z.points.length > 3) {
                              onZoneChange(z.id, z.points.filter((_, j) => j !== i));
                            }
                          },
                        }}
                      />
                    ))}
                  </>
                ) : null}
              </Fragment>
            );
          })}

          {/* draft being drawn */}
          {draftPreview.length > 1 ? (
            <Polyline
              positions={draftPreview.map((p) => [p.lat, p.lng]) as [number, number][]}
              pathOptions={{ color: "#c8102e", weight: 3, dashArray: "6 5" }}
            />
          ) : null}
          {draft.map((p, i) => (
            <Marker key={`draft-${i}`} position={[p.lat, p.lng]} icon={handleIcon("#c8102e", 10)} />
          ))}

          {hotspots
            .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
            .map((s) => (
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
              >
                {onDeleteHotspot && !locked ? (
                  <Popup autoPan={false} closeButton={false}>
                    <MapDeleteBubble
                      label={s.title || "this point"}
                      onDelete={() => onDeleteHotspot(s.id)}
                    />
                  </Popup>
                ) : null}
              </Marker>
            ))}
        </MapContainer>
      </div>

      <div className="absolute bottom-3 right-3 z-[500] flex gap-2">
        <button
          type="button"
          onClick={() => setFitToken((t) => t + 1)}
          className="rounded-xl bg-card/95 px-3 py-1.5 text-[11px] font-bold text-ink shadow ring-1 ring-border backdrop-blur"
        >
          Zoom to areas
        </button>
        <button
          type="button"
          onClick={() => setShowLabels((v) => !v)}
          className="rounded-xl bg-card/95 px-3 py-1.5 text-[11px] font-bold text-ink shadow ring-1 ring-border backdrop-blur"
        >
          {showLabels ? "Hide names" : "Show names"}
        </button>
      </div>

      {locked ? (
        <div className="absolute inset-x-3 bottom-14 z-[500] flex justify-center">
          <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-xl bg-ink/90 px-3 py-2 text-[11px] font-bold text-white shadow-lg backdrop-blur">
            <span>
              {placing ? "Add point mode" : "Draw area mode"} — area editing is locked.
            </span>
            <span className="font-semibold opacity-80">
              {placing
                ? "Click the map to drop a point, then exit to edit areas."
                : "Finish or cancel the outline to edit areas again."}
            </span>
            <button
              type="button"
              onClick={() => {
                if (placing) onCancelPlace?.();
                else {
                  setDraft([]);
                  onCancelDraw();
                }
              }}
              className="rounded-lg bg-white/15 px-2 py-1 ring-1 ring-white/30"
            >
              Exit {placing ? "add point" : "draw"} mode
            </button>
          </div>
        </div>
      ) : null}

      {drawing ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center px-3">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl bg-card/95 px-3 py-2 text-[11px] font-bold text-ink shadow-lg ring-1 ring-border backdrop-blur">
            <span className="text-ink-soft">
              {draft.length === 0
                ? "Click the map to start the outline"
                : `${draft.length} point${draft.length === 1 ? "" : "s"} · edge ${formatLength(liveEdge)}`}
            </span>
            <button
              onClick={() => setDraft((d) => d.slice(0, -1))}
              disabled={draft.length === 0}
              className="rounded-lg bg-muted px-2 py-1 disabled:opacity-50"
            >
              Undo point
            </button>
            <button
              onClick={() => {
                if (draft.length > 2) onDrawn(draft);
                setDraft([]);
              }}
              disabled={draft.length < 3}
              className="rounded-lg cherry-gradient px-2 py-1 text-white disabled:opacity-50"
            >
              Finish area
            </button>
            <button
              onClick={() => {
                setDraft([]);
                onCancelDraw();
              }}
              className="rounded-lg bg-muted px-2 py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : activeZone && !locked ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center px-3">
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-xl bg-card/95 px-3 py-2 shadow-lg ring-1 ring-border backdrop-blur">
            <input
              value={activeZone.name}
              onChange={(e) => onRenameZone?.(activeZone.id, e.target.value)}
              placeholder="Area name"
              className="w-40 rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold"
            />
            <button
              onClick={() => onDuplicateZone?.(activeZone.id)}
              className="rounded-lg cherry-gradient px-2 py-1 text-[11px] font-bold text-white"
            >
              Copy area
            </button>
            <button
              onClick={() => onSelectZone(null)}
              className="rounded-lg bg-muted px-2 py-1 text-[11px] font-bold"
            >
              Done
            </button>
            <span className="text-[11px] font-semibold text-ink-soft">
              Drag ✥ to move · white dots reshape · {formatLength(zonePerimeterM(activeZone))} perimeter
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
