import { useEffect, useMemo, useRef, useState } from "react";
import { Flag, MapPin, Mountain, Pause, Play, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseKml, type LatLngAlt } from "@/lib/geo";
import type { EventDay } from "@/lib/mock-data";
import overviewImage from "@/assets/pe-plett-journey/pe-plett-route-overview-2027.jpg.asset.json";

const PE_PLETT_EVENT_ID = "003c81de-59a6-4165-9d41-9699fa0d4b32";

type DrawnStage = {
  id: string;
  label: string;
  name: string;
  color: string;
  distanceKm: number;
  elevationM: number;
  path: string;
};

function toPath(lines: LatLngAlt[][], bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number }) {
  const width = Math.max(0.001, bounds.maxLng - bounds.minLng);
  const height = Math.max(0.001, bounds.maxLat - bounds.minLat);
  return lines
    .map((line) =>
      line
        .map(([lng, lat], index) => {
          const x = 5 + ((lng - bounds.minLng) / width) * 90;
          const y = 7 + (1 - (lat - bounds.minLat) / height) * 86;
          return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" "),
    )
    .join(" ");
}

export function isPePlettJourney(eventId: string) {
  return eventId === PE_PLETT_EVENT_ID;
}

export function PePlettJourney({
  days,
  activeDay,
  onSelectDay,
}: {
  days: EventDay[];
  activeDay: string;
  onSelectDay: (dayId: string) => void;
}) {
  const routeDays = useMemo(() => days.filter((day) => (day.routes ?? []).length > 0), [days]);
  const [drawn, setDrawn] = useState<DrawnStage[]>([]);
  const [playing, setPlaying] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded: Array<Omit<DrawnStage, "path"> & { lines: LatLngAlt[][] }> = [];
      for (const [index, day] of routeDays.entries()) {
        const route = day.routes[0];
        const lines: LatLngAlt[][] = [];
        for (const url of route.kmlUrls ?? []) {
          try {
            const response = await fetch(url);
            if (!response.ok) continue;
            lines.push(...parseKml(await response.text()).lines);
          } catch {
            // The route overview image remains visible if a route file is unavailable.
          }
        }
        loaded.push({
          id: day.id,
          label: `Stage ${index + 1}`,
          name: route.name,
          color: route.color ?? "#7ebd5f",
          distanceKm: route.distanceKm,
          elevationM: route.elevationM ?? 0,
          lines,
        });
      }
      const points = loaded.flatMap((stage) => stage.lines.flat());
      if (cancelled || points.length === 0) return;
      const lngs = points.map(([lng]) => lng);
      const lats = points.map(([, lat]) => lat);
      const bounds = {
        minLng: Math.min(...lngs),
        maxLng: Math.max(...lngs),
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
      };
      setDrawn(loaded.map((stage) => ({ ...stage, path: toPath(stage.lines, bounds) })));
    })();
    return () => {
      cancelled = true;
    };
  }, [routeDays]);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setPlaying(entry.isIntersecting && entry.intersectionRatio > 0.25),
      { threshold: [0, 0.25] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const restart = () => {
    setAnimationKey((key) => key + 1);
    setPlaying(true);
  };

  return (
    <section ref={sectionRef} className="overflow-hidden rounded-2xl bg-pe-plett text-pe-plett-foreground shadow-sm">
      <div className="relative min-h-[300px] overflow-hidden px-5 py-6 sm:px-7">
        <img
          src={overviewImage.url}
          alt="PE Plett 2027 journey from St Francis Links to Nature's Valley"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-pe-plett/80" />
        <div className="relative z-10 max-w-xl">
          <p className="inline-flex rounded-full bg-pe-plett-accent px-3 py-1 text-[10px] font-extrabold uppercase text-pe-plett-accent-foreground">
            15th edition · 17–21 Feb 2027
          </p>
          <h2 className="mt-4 font-display text-3xl font-bold uppercase leading-none sm:text-4xl">
            The unique journey
          </h2>
          <p className="mt-2 font-display text-base font-bold uppercase text-pe-plett-accent">
            St Francis Links to Nature’s Valley
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-pe-plett-foreground/80">
            Four stages. 262 km. 4,016 m of climbing. The wind at your back and the Garden Route ahead.
          </p>
        </div>

        <div className="relative z-10 mt-5 overflow-hidden rounded-xl border border-pe-plett-accent/30 bg-pe-plett-deep/70 p-2">
          {drawn.length > 0 ? (
            <svg
              key={animationKey}
              viewBox="0 0 100 100"
              className="aspect-[16/8] w-full"
              role="img"
              aria-label="Animated overview of all four PE Plett stages"
            >
              {drawn.map((stage, index) => (
                <path
                  key={stage.id}
                  d={stage.path}
                  fill="none"
                  stroke={stage.color}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength="1"
                  className={playing ? "animate-pe-plett-route" : ""}
                  style={{ animationDelay: `${index * 650}ms` }}
                />
              ))}
            </svg>
          ) : (
            <div className="aspect-[16/8] animate-pulse rounded-lg bg-pe-plett-foreground/10" />
          )}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => (playing ? setPlaying(false) : restart())}
            className="absolute bottom-3 right-3 gap-1.5"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? "Pause" : "Replay"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-pe-plett-accent/20 sm:grid-cols-4">
        {routeDays.map((day, index) => {
          const route = day.routes[0];
          const selected = activeDay === day.id;
          return (
            <button
              key={day.id}
              type="button"
              onClick={() => onSelectDay(day.id)}
              className={`min-h-24 border-pe-plett-accent/20 p-3 text-left transition first:border-l-0 sm:border-l ${
                selected ? "bg-pe-plett-accent text-pe-plett-accent-foreground" : "bg-pe-plett-deep/70 hover:bg-pe-plett-deep"
              }`}
            >
              <span className="text-[9px] font-extrabold uppercase opacity-70">Stage {index + 1}</span>
              <span className="mt-1 block text-xs font-bold leading-tight">{route.name}</span>
              <span className="mt-2 block text-[10px] opacity-75">
                {route.distanceKm.toFixed(1)} km · {String(route.elevationM ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} m
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-px bg-pe-plett-accent/20 text-center text-[10px] font-semibold">
        <div className="bg-pe-plett-deep px-2 py-3"><RouteIcon className="mx-auto mb-1 h-4 w-4 text-pe-plett-accent" />262 km</div>
        <div className="bg-pe-plett-deep px-2 py-3"><Mountain className="mx-auto mb-1 h-4 w-4 text-pe-plett-accent" />4,016 m</div>
        <div className="bg-pe-plett-deep px-2 py-3"><span className="mb-1 flex justify-center"><MapPin className="h-4 w-4 text-pe-plett-accent" /><Flag className="h-4 w-4 text-pe-plett-accent" /></span>4 stages</div>
      </div>
    </section>
  );
}