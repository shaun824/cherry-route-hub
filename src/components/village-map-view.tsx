import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { Maximize2, Minimize2, Minus, Plus, X } from "lucide-react";
import {
  VILLAGE_LAYERS,
  categoryMeta,
  fetchVillageMap,
  fetchVillageMaps,
  hasVenueCentre,
  isPinnedSpot,
  isPlacedGeo,
  spotColor,
  spotIcon,
  spotLayer,
  type VillageHotspot,
  type VillageLayer,
} from "@/lib/village-map";
import { villageIcon } from "@/lib/village-icons";
import {
  formatArea,
  hasBuildDetail,
  riderSeesZone,
  zoneAreaM2,
  zoneColor,
  zoneKindLabel,
  zoneSizeM,
} from "@/lib/village-zones";

import { fetchVillageTents } from "@/lib/village-tents";
import { useIsCrew } from "@/lib/auth";
import { useLockPageZoom } from "@/lib/use-lock-page-zoom";
import { supabase } from "@/integrations/supabase/client";



const VillageMapGeo = lazy(() => import("./village-map-geo"));

// Full screen has to escape the page tree: any ancestor with a transform or
// filter makes `position: fixed` behave like `absolute`, which is why the
// "full screen" map stayed card-sized.
function Portal({ active, children }: { active: boolean; children: ReactNode }) {
  if (!active || typeof document === "undefined") return <>{children}</>;
  return createPortal(children, document.body);
}

function Pin({
  spot,
  active,
  onHover,
  onSelect,
  scale,
}: {
  spot: VillageHotspot;
  active: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  scale: number;
}) {
  const color = spotColor(spot);
  const Icon = villageIcon(spotIcon(spot)).Comp;
  return (
    <button
      type="button"
      onMouseEnter={() => onHover(spot.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(spot.id)}
      style={{
        left: `${spot.x}%`,
        top: `${spot.y}%`,
        transform: `translate(-50%, -100%) scale(${1 / scale})`,
        transformOrigin: "bottom center",
      }}
      className="absolute z-10 flex flex-col items-center focus:outline-none"
      aria-label={spot.title}
    >
      <span
        className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold text-white shadow-lg transition ${
          active ? "ring-2 ring-white" : ""
        }`}
        style={{ backgroundColor: color }}
      >
        <Icon className="h-3 w-3" />
        {spot.title}
      </span>
      <span
        className="h-2 w-2 -translate-y-[3px] rotate-45 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
    </button>
  );
}

export function VillageMapView({
  eventId,
  focusSpotId,
  focusZoneId,
  focusTentId,
  venueId: venueIdProp,
  defaultLayers,
  riderOnly = false,
}: {
  eventId: string;
  focusSpotId?: string | null;
  focusZoneId?: string | null;
  focusTentId?: string | null;
  /** Jump straight to one venue's village (used by crew "find this tent"). */
  venueId?: string | null;
  /** Crew build map opens with the build layers already switched on. */
  defaultLayers?: VillageLayer[];
  /**
   * Force the exact rider view — no crew layers, labels or build cards — even
   * when the signed-in user is crew. Used on the rider event page so crew can
   * validate precisely what riders see.
   */
  riderOnly?: boolean;
}) {
  // Pinch on the village map must zoom the map only — never the page itself.
  useLockPageZoom();
  // Multi-day events run more than one race village — one per venue.
  const venuesQ = useQuery({
    queryKey: ["village-venues", eventId],
    queryFn: async () => {
      const [{ data: venues }, maps] = await Promise.all([
        supabase
          .from("event_venues")
          .select("id, name, sort_order")
          .eq("event_id", eventId)
          .order("sort_order", { ascending: true }),
        fetchVillageMaps(eventId),
      ]);
      const withMaps = new Set(maps.map((m) => m.venue_id).filter(Boolean) as string[]);
      return (venues ?? []).filter((v) => withMaps.has(v.id));
    },
  });
  const venues = venuesQ.data ?? [];
  const [venuePick, setVenuePick] = useState<string | null>(venueIdProp ?? null);
  useEffect(() => {
    if (venueIdProp) setVenuePick(venueIdProp);
  }, [venueIdProp]);
  const venueId = venuePick ?? venues[0]?.id ?? null;

  const q = useQuery({
    queryKey: ["village-map", eventId, venueId],
    queryFn: () => fetchVillageMap(eventId, venueId),
  });
  const tentsQ = useQuery({
    queryKey: ["village-tents", eventId, venueId],
    queryFn: () => fetchVillageTents(eventId, venueId),
  });
  const tents = tentsQ.data ?? [];
  const mapTents = useMemo(
    () =>
      tents
        .filter((t) => t.kind !== "marker")
        .map((t) => ({ id: t.id, label: t.label, lat: t.lat, lng: t.lng, kind: t.kind, tent_type: t.tent_type, rotation: t.rotation })),
    [tents],
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const [filter, setFilter] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [mode, setMode] = useState<"live" | "plan">("live");
  // Build layers (infrastructure + branding) are crew/admin only — riders never
  // see generators, cable runs or banner positions.
  const { isCrew: signedInCrew } = useIsCrew();
  const isCrew = signedInCrew && !riderOnly;
  const [layers, setLayers] = useState<VillageLayer[]>(defaultLayers ?? ["rider"]);
  const visibleLayers = useMemo<VillageLayer[]>(() => (isCrew ? layers : ["rider"]), [isCrew, layers]);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Plan-view full screen + pinch zoom (the live map handles both natively).
  const [planFullscreen, setPlanFullscreen] = useState(false);
  const scaleRef = useRef(1);
  scaleRef.current = scale;

  useEffect(() => {
    document.body.style.overflow = planFullscreen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [planFullscreen]);

  // Two-finger pinch on the plan image: scale follows the finger spread, and
  // one-finger scrolling keeps panning the zoomed image inside its container.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch: { d: number; s: number } | null = null;
    const clamp = (v: number) => Math.min(4, Math.max(1, v));
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: scaleRef.current };
      }
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch.d > 0) setScale(clamp(+(pinch.s * (d / pinch.d)).toFixed(3)));
      }
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);

  // Crew "find this room" deep-focus: highlight the requested point when it changes.
  useEffect(() => {
    if (focusSpotId) {
      setSelected(focusSpotId);
      setFilter(null);
    }
  }, [focusSpotId]);

  const map = q.data;

  // Legacy imports left numeric "tent number" points behind — those live on the
  // tent layer, so keep them out of the facility icons and legend.
  const facilities = useMemo(
    () =>
      (map?.hotspots ?? []).filter(
        (s) =>
          s.title?.trim() &&
          !/^(?:tent\s*)?\d+$/i.test(s.title.trim()) &&
          visibleLayers.includes(spotLayer(s)),
      ),
    [map, visibleLayers],
  );

  // Crew build list: every infrastructure / branding item currently shown.
  const buildItems = useMemo(
    () => facilities.filter((s) => spotLayer(s) !== "rider"),
    [facilities],
  );
  const spots = useMemo(
    () => facilities.filter((s) => !filter || s.category === filter),
    [facilities, filter],
  );
  const categories = useMemo(() => {
    const seen = new Set(facilities.map((s) => s.category));
    return Array.from(seen);
  }, [facilities]);

  const hasImage = !!map?.image_url;
  const pinnedCount = (map?.hotspots ?? []).filter(isPinnedSpot).length;
  const zoneCount = (map?.zones ?? []).length;
  // Drawn zones are already geographic, so a village with only zones (no image,
  // no pins) is still a perfectly usable live map.
  const geoReady =
    hasVenueCentre(map?.geo) &&
    ((hasImage && isPlacedGeo(map?.geo)) || pinnedCount > 0 || zoneCount > 0 || tents.length > 0);
  const focusZone = (map?.zones ?? []).find((z) => z.id === focusZoneId) ?? null;
  const detail = facilities.find((s) => s.id === (selected ?? hovered)) ?? null;
  // Crew-only: drawn areas that carry build detail (Bedouin tents, speed
  // fencing, candy-taped cordons…). Riders never see any of this.
  const buildZones = useMemo(
    () => (isCrew ? (map?.zones ?? []).filter(hasBuildDetail) : []),
    [isCrew, map?.zones],
  );
  // Any tapped area shows its detail to crew, even before build fields are filled in.
  const zoneDetail =
    (isCrew ? (map?.zones ?? []).find((z) => z.id === selectedZone) : null) ?? null;


  const venueTabs =
    venues.length > 1 ? (
      <div className="flex flex-wrap gap-1.5">
        {venues.map((v) => (
          <button
            key={v.id}
            onClick={() => setVenuePick(v.id)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
              venueId === v.id ? "bg-cherry text-white" : "bg-muted text-ink-soft"
            }`}
          >
            {v.name}
          </button>
        ))}
      </div>
    ) : null;

  const showLive = geoReady && (mode === "live" || !hasImage);

  // Plan view: tapping a chip or a pin zooms in and centres the chosen facility.
  useEffect(() => {
    if (showLive || !selected || !wrapRef.current) return;
    const spot = facilities.find((s) => s.id === selected);
    if (!spot) return;
    const wrap = wrapRef.current;
    const img = wrap.querySelector("img");
    if (!img) return;
    const targetScale = 3;
    setScale(targetScale);
    const center = () => {
      const rect = wrap.getBoundingClientRect();
      const scaledWidth = rect.width * targetScale;
      const scaledHeight = img.offsetHeight * targetScale;
      const x = (spot.x / 100) * scaledWidth;
      const y = (spot.y / 100) * scaledHeight;
      wrap.scrollTo({
        left: Math.max(0, x - rect.width / 2),
        top: Math.max(0, y - rect.height / 2),
        behavior: "smooth",
      });
    };
    const t = window.setTimeout(center, 220);
    return () => window.clearTimeout(t);
  }, [selected, showLive, facilities]);

  if (q.isLoading) {
    return <div className="h-56 animate-pulse rounded-2xl bg-muted" />;
  }

  if (!map || (!hasImage && !geoReady)) {
    return (
      <div className="space-y-3">
        {venueTabs}
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
          The village map for this venue hasn't been published yet — check back closer to race week.
        </div>
      </div>
    );
  }



  return (
    <div className="space-y-3">
      {venueTabs}
      {focusZone ? (
        <p className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-cherry-deep">
          Highlighted in red: {focusZone.name || "your spot"}.
        </p>
      ) : null}



      {map.intro ? <p className="text-sm leading-relaxed text-ink-soft">{map.intro}</p> : null}

      {geoReady && hasImage ? (

        <div className="flex gap-1.5">
          {(["live", "plan"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                mode === m ? "bg-cherry text-white" : "bg-muted text-ink-soft"
              }`}
            >
              {m === "live" ? "Live map" : "Plan view"}
            </button>
          ))}
        </div>
      ) : null}

      {isCrew ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
            Layers
          </span>
          <button
            title="Show every point from every layer at once"
            onClick={() =>
              setLayers((prev) =>
                prev.length === VILLAGE_LAYERS.length
                  ? (defaultLayers ?? ["rider"])
                  : VILLAGE_LAYERS.map((l) => l.id),
              )
            }
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
              layers.length === VILLAGE_LAYERS.length
                ? "bg-ink text-background ring-ink"
                : "bg-muted text-ink-soft ring-border"
            }`}
          >
            All points
          </button>
          {VILLAGE_LAYERS.map((l) => {
            const on = layers.includes(l.id);
            return (
              <button
                key={l.id}
                title={l.blurb}
                onClick={() =>
                  setLayers((prev) =>
                    prev.includes(l.id) ? prev.filter((p) => p !== l.id) : [...prev, l.id],
                  )
                }
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  on ? "bg-cherry text-white" : "bg-muted text-ink-soft"
                }`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {categories.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter(null)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              filter === null ? "bg-cherry text-white" : "bg-muted text-ink-soft"
            }`}
          >
            All
          </button>
          {categories.map((c) => {
            const meta = categoryMeta(c);
            const active = filter === c;
            return (
              <button
                key={c}
                onClick={() => setFilter(active ? null : c)}
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                style={{ backgroundColor: active ? meta.color : `${meta.color}66` }}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Summarised key: every facility as a compact tappable chip, above the map. */}
      {facilities.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {facilities.map((s) => {
            const ChipIcon = villageIcon(spotIcon(s)).Comp;
            const active = (selected ?? hovered) === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelected((prev) => (prev === s.id ? null : s.id))}
                onMouseEnter={() => setHovered(s.id)}
                onMouseLeave={() => setHovered(null)}
                className={`flex items-center gap-1.5 rounded-full bg-card py-1 pl-1 pr-2.5 text-[11px] font-semibold text-ink ring-1 ${
                  active ? "ring-2 ring-cherry" : "ring-border"
                }`}
              >
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-white"
                  style={{ backgroundColor: spotColor(s) }}
                >
                  <ChipIcon className="h-3 w-3" />
                </span>
                <span className="max-w-[9rem] truncate">{s.title}</span>
              </button>
            );
          })}
        </div>
      ) : null}


      {showLive ? (
        <ClientOnly fallback={<div className="h-[65vh] min-h-[340px] animate-pulse rounded-2xl bg-muted" />}>
          <Suspense fallback={<div className="h-[65vh] min-h-[340px] animate-pulse rounded-2xl bg-muted" />}>
            <VillageMapGeo
              imageUrl={map.image_url}
              geo={map.geo!}
              hotspots={spots}
              zones={
                isCrew
                  ? (map.zones ?? [])
                  : (map.zones ?? []).filter(riderSeesZone)
              }
              selected={selected}
              onSelect={setSelected}
              tents={mapTents}
              zonesInteractive={isCrew}
              onZoneSelect={(id) => setSelectedZone((prev) => (prev === id ? null : id))}
              highlightZoneId={selectedZone ?? focusZoneId ?? null}
              highlightTentId={focusTentId ?? null}

            />
          </Suspense>
        </ClientOnly>
      ) : (
      <Portal active={planFullscreen}>
      <div
        className={
          planFullscreen
            ? "fixed inset-0 z-[9999] h-[100dvh] w-screen bg-black"
            : "relative overflow-hidden rounded-2xl ring-1 ring-border"
        }
      >
        <div
          ref={wrapRef}
          className={`overflow-auto bg-muted [touch-action:pan-x_pan-y] ${
            planFullscreen ? "h-full" : "max-h-[70vh]"
          }`}
        >
          <div
            className="relative w-full origin-top-left transition-transform duration-200"
            style={{ transform: `scale(${scale})`, width: `${100}%` }}
          >
            <img
              src={map.image_url ?? undefined}
              alt="Event village map"
              className="block w-full select-none"
              draggable={false}
            />
            {spots.map((s) => (
              <Pin
                key={s.id}
                spot={s}
                scale={scale}
                active={(selected ?? hovered) === s.id}
                onHover={setHovered}
                onSelect={(id) => setSelected((prev) => (prev === id ? null : id))}
              />
            ))}
          </div>
        </div>

        <div className="absolute bottom-3 right-3 flex flex-col gap-1">
          <button
            onClick={() => setPlanFullscreen((f) => !f)}
            className="grid h-8 w-8 place-items-center rounded-full bg-card/95 shadow ring-1 ring-border"
            aria-label={planFullscreen ? "Exit full screen" : "View full screen"}
          >
            {planFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setScale((s) => Math.min(4, +(s + 0.25).toFixed(2)))}
            className="grid h-8 w-8 place-items-center rounded-full bg-card/95 shadow ring-1 ring-border"
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(1, +(s - 0.25).toFixed(2)))}
            className="grid h-8 w-8 place-items-center rounded-full bg-card/95 shadow ring-1 ring-border"
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>
      </Portal>
      )}


      {detail ? (
        <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <div className="flex items-start gap-2">
            {(() => {
              const DetailIcon = villageIcon(spotIcon(detail)).Comp;
              return (
                <span
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-white"
                  style={{ backgroundColor: spotColor(detail) }}
                >
                  <DetailIcon className="h-3.5 w-3.5" />
                </span>
              );
            })()}
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-bold text-ink">{detail.title}</p>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">
                {categoryMeta(detail.category).label}
                {detail.hours ? ` · ${detail.hours}` : ""}
              </p>
              {detail.spec ? (
                <p className="mt-1 text-sm font-semibold text-ink">{detail.spec}</p>
              ) : null}
              {detail.description ? (
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{detail.description}</p>
              ) : null}
              {isCrew && detail.crewNotes ? (
                <div className="mt-2 rounded-xl bg-muted/60 p-2 ring-1 ring-border">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">Crew only</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">{detail.crewNotes}</p>
                </div>
              ) : null}
            </div>
            {selected ? (
              <button onClick={() => setSelected(null)} aria-label="Close">
                <X className="h-4 w-4 text-ink-soft" />
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-center text-xs text-ink-soft">
          Hover or tap a marker to see what's there.
        </p>
      )}

      {zoneDetail ? (
        <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <div className="flex items-start gap-2">
            <span
              className="mt-1 h-4 w-4 shrink-0 rounded"
              style={{ backgroundColor: zoneColor(zoneDetail) }}
            />
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-bold text-ink">{zoneDetail.name}</p>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">
                Crew only · {zoneKindLabel(zoneDetail.kind)}
              </p>
              <p className="mt-1 text-xs text-ink-soft">
                {(() => {
                  const s = zoneSizeM(zoneDetail);
                  return `${Math.round(s.w)}m × ${Math.round(s.h)}m · ${formatArea(zoneAreaM2(zoneDetail))}`;
                })()}
              </p>
              {zoneDetail.spec ? (
                <p className="mt-2 text-sm font-semibold text-ink">{zoneDetail.spec}</p>
              ) : null}
              {zoneDetail.notes?.trim() ? (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                  {zoneDetail.notes}
                </p>
              ) : null}
              {zoneDetail.crewNotes ? (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                  {zoneDetail.crewNotes}
                </p>
              ) : null}
              {!zoneDetail.spec?.trim() &&
              !zoneDetail.notes?.trim() &&
              !zoneDetail.crewNotes?.trim() ? (
                <p className="mt-2 text-sm italic text-ink-soft">
                  No requirements captured for this area yet.
                </p>
              ) : null}
            </div>
            <button onClick={() => setSelectedZone(null)} aria-label="Close">
              <X className="h-4 w-4 text-ink-soft" />
            </button>
          </div>
        </div>
      ) : null}

      {isCrew && buildZones.length > 0 ? (
        <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <p className="font-display text-sm font-bold text-ink">Build areas</p>
          <p className="text-[11px] text-ink-soft">
            Crew only — tap an area to zoom to it and see what it should contain.
          </p>
          <div className="mt-3 space-y-3">
            {Array.from(new Set(buildZones.map((z) => zoneKindLabel(z.kind)))).map((kindLabel) => (
              <div key={kindLabel}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                  {kindLabel}
                </p>
                <ul className="mt-1 space-y-1">
                  {buildZones
                    .filter((z) => zoneKindLabel(z.kind) === kindLabel)
                    .map((z) => {
                      const s = zoneSizeM(z);
                      return (
                        <li key={z.id}>
                          <button
                            onClick={() => setSelectedZone((prev) => (prev === z.id ? null : z.id))}
                            className="w-full rounded-lg px-2 py-1 text-left hover:bg-muted"
                          >
                            <span className="flex items-baseline justify-between gap-3">
                              <span className="text-sm font-semibold text-ink">{z.name}</span>
                              <span className="shrink-0 text-[11px] font-semibold text-ink-soft">
                                {Math.round(s.w)}m × {Math.round(s.h)}m
                              </span>
                            </span>
                            {z.spec ? (
                              <span className="block text-[11px] text-ink-soft">{z.spec}</span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isCrew && buildItems.length > 0 ? (

        <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <p className="font-display text-sm font-bold text-ink">Build list</p>
          <p className="text-[11px] text-ink-soft">
            Everything on the layers you have switched on — tap an item to zoom to it.
          </p>
          <div className="mt-3 space-y-3">
            {Array.from(new Set(buildItems.map((s) => s.category))).map((cat) => {
              const meta = categoryMeta(cat);
              const rows = buildItems.filter((s) => s.category === cat);
              return (
                <div key={cat}>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {rows.map((s) => (
                      <li key={s.id}>
                        <button
                          onClick={() => setSelected((prev) => (prev === s.id ? null : s.id))}
                          className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1 text-left text-sm hover:bg-muted"
                        >
                          <span className="font-semibold text-ink">{s.title}</span>
                          <span className="shrink-0 text-[11px] font-semibold text-ink-soft">
                            {s.spec || "—"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

    </div>
  );
}
