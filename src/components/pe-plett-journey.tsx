import { useMemo } from "react";
import { Mountain, Route as RouteIcon } from "lucide-react";
import type { EventDay } from "@/lib/mock-data";

const PE_PLETT_EVENT_ID = "003c81de-59a6-4165-9d41-9699fa0d4b32";

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

  return (
    <section className="overflow-hidden rounded-2xl bg-pe-plett text-pe-plett-foreground shadow-sm">
      <div className="px-5 py-6 sm:px-7">
        <div className="max-w-xl">
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

        <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-pe-plett-accent/20 text-center text-[10px] font-semibold">
          <div className="bg-pe-plett-deep px-2 py-3"><RouteIcon className="mx-auto mb-1 h-4 w-4 text-pe-plett-accent" />262 km</div>
          <div className="bg-pe-plett-deep px-2 py-3"><Mountain className="mx-auto mb-1 h-4 w-4 text-pe-plett-accent" />4,016 m</div>
          <div className="bg-pe-plett-deep px-2 py-3"><span className="mb-1 block text-base font-bold text-pe-plett-accent">4</span>stages</div>
        </div>
      </div>

      <div className="flex overflow-x-auto border-t border-pe-plett-accent/20">
        <button
          type="button"
          onClick={() => onSelectDay("all")}
          className={`min-h-20 min-w-24 flex-1 p-3 text-left transition ${activeDay === "all" ? "bg-pe-plett-accent text-pe-plett-accent-foreground" : "bg-pe-plett-deep/70 hover:bg-pe-plett-deep"}`}
        >
          <span className="text-[9px] font-extrabold uppercase opacity-70">All stages</span>
          <span className="mt-1 block text-xs font-bold">Full journey</span>
        </button>
        {routeDays.map((day, index) => {
          const route = day.routes[0];
          const selected = activeDay === day.id;
          return (
            <button
              key={day.id}
              type="button"
              onClick={() => onSelectDay(day.id)}
              className={`min-h-20 min-w-32 flex-1 border-l border-pe-plett-accent/20 p-3 text-left transition ${
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
    </section>
  );
}