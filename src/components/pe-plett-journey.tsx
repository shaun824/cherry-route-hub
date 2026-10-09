import { useMemo } from "react";
import { Mountain, Route as RouteIcon } from "lucide-react";
import type { EventDay } from "@/lib/mock-data";

const PE_PLETT_EVENT_ID = "003c81de-59a6-4165-9d41-9699fa0d4b32";

export function isPePlettJourney(eventId: string) {
  return eventId === PE_PLETT_EVENT_ID;
}

// Simple, app-styled stage picker for PE Plett (same look as other events' route pages).
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
  const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <h2 className="font-display text-lg font-bold text-ink">St Francis Links to Nature’s Valley</h2>
      <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold text-ink-soft">
        <span className="inline-flex items-center gap-1"><RouteIcon className="h-3.5 w-3.5 text-cherry" /> 262 km</span>
        <span className="inline-flex items-center gap-1"><Mountain className="h-3.5 w-3.5 text-cherry" /> 4,016 m</span>
        <span>4 stages</span>
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onSelectDay("all")}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-border ${activeDay === "all" ? "bg-ink text-background" : "bg-card text-ink"}`}
        >
          All stages
        </button>
        {routeDays.map((day, index) => {
          const route = day.routes[0];
          return (
            <button
              key={day.id}
              type="button"
              onClick={() => onSelectDay(day.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-border ${activeDay === day.id ? "bg-ink text-background" : "bg-card text-ink"}`}
            >
              Stage {index + 1} · {route.distanceKm.toFixed(0)} km{route.elevationM ? ` · ${fmt(route.elevationM)} m` : ""}
            </button>
          );
        })}
      </div>
    </section>
  );
}
