import { Suspense, lazy, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClientOnly } from "@tanstack/react-router";
import { MapPin, Minus, Plus, X } from "lucide-react";
import {
  categoryMeta,
  fetchVillageMap,
  isPlacedGeo,
  type VillageHotspot,
} from "@/lib/village-map";

const VillageMapGeo = lazy(() => import("./village-map-geo"));

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
  const meta = categoryMeta(spot.category);
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
        style={{ backgroundColor: meta.color }}
      >
        <MapPin className="h-3 w-3" />
        {spot.title}
      </span>
      <span
        className="h-2 w-2 -translate-y-[3px] rotate-45 rounded-[2px]"
        style={{ backgroundColor: meta.color }}
      />
    </button>
  );
}

export function VillageMapView({ eventId }: { eventId: string }) {
  const q = useQuery({ queryKey: ["village-map", eventId], queryFn: () => fetchVillageMap(eventId) });
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [mode, setMode] = useState<"live" | "plan">("live");
  const wrapRef = useRef<HTMLDivElement>(null);

  const map = q.data;
  const spots = useMemo(
    () => (map?.hotspots ?? []).filter((s) => !filter || s.category === filter),
    [map, filter],
  );
  const categories = useMemo(() => {
    const seen = new Set((map?.hotspots ?? []).map((s) => s.category));
    return Array.from(seen);
  }, [map]);
  const geoReady = isPlacedGeo(map?.geo);
  const detail = (map?.hotspots ?? []).find((s) => s.id === (selected ?? hovered)) ?? null;

  if (q.isLoading) {
    return <div className="h-56 animate-pulse rounded-2xl bg-muted" />;
  }

  if (!map?.image_url) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
        The village map for this event hasn't been published yet — check back closer to race week.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {map.intro ? <p className="text-sm leading-relaxed text-ink-soft">{map.intro}</p> : null}

      {geoReady ? (
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

      {geoReady && mode === "live" ? (
        <ClientOnly fallback={<div className="h-[65vh] min-h-[340px] animate-pulse rounded-2xl bg-muted" />}>
          <Suspense fallback={<div className="h-[65vh] min-h-[340px] animate-pulse rounded-2xl bg-muted" />}>
            <VillageMapGeo
              imageUrl={map.image_url}
              geo={map.geo!}
              hotspots={spots}
              selected={selected}
              onSelect={setSelected}
            />
          </Suspense>
        </ClientOnly>
      ) : (
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-border">
        <div ref={wrapRef} className="max-h-[70vh] overflow-auto bg-muted">
          <div
            className="relative w-full origin-top-left transition-transform duration-200"
            style={{ transform: `scale(${scale})`, width: `${100}%` }}
          >
            <img
              src={map.image_url}
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
            onClick={() => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))}
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
      )}

      {detail ? (
        <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <div className="flex items-start gap-2">
            <span
              className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: categoryMeta(detail.category).color }}
            />
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-bold text-ink">{detail.title}</p>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">
                {categoryMeta(detail.category).label}
                {detail.hours ? ` · ${detail.hours}` : ""}
              </p>
              {detail.description ? (
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{detail.description}</p>
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

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {(map.hotspots ?? []).map((s) => (
          <li key={s.id}>
            <button
              onClick={() => setSelected(s.id)}
              onMouseEnter={() => setHovered(s.id)}
              onMouseLeave={() => setHovered(null)}
              className="flex w-full items-center gap-2 rounded-xl bg-card px-3 py-2 text-left text-sm ring-1 ring-border"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: categoryMeta(s.category).color }}
              />
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{s.title}</span>
              {s.hours ? <span className="text-[11px] text-ink-soft">{s.hours}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
