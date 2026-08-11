import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bike, ChevronDown, Motorbike } from "lucide-react";

import { formatDate, type Event } from "@/lib/mock-data";
import { getEventSport } from "@/lib/event-sport";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";

function daysAway(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(diff)) return "";
  if (diff <= 0) return "Underway";
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 31) return `In ${days} days`;
  const months = Math.round(days / 30);
  return `In ${months} month${months > 1 ? "s" : ""}`;
}

/**
 * Stacked "events coming up" list grouped by sport. Every card links straight
 * into the refined event overview at /my-events/$eventId.
 */
export function UpcomingBySport({
  excludeIds = [],
  heading = "More events coming up",
  limit = 6,
}: {
  excludeIds?: string[];
  heading?: string | null;
  limit?: number;
}) {
  useHydratedStore();
  const allEvents = useAdminStore((s) => s.events);
  const skip = new Set(excludeIds);

  const upcoming = allEvents
    .filter((e) => (e.lifecycle ?? "published") === "published")
    .filter((e) => !skip.has(e.id))
    .filter((e) => new Date(e.date).getTime() >= Date.now() - 12 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const moto = upcoming.filter((e) => getEventSport(e.discipline, e.name) === "moto").slice(0, limit);
  const mtb = upcoming.filter((e) => getEventSport(e.discipline, e.name) === "mtb").slice(0, limit);

  if (moto.length === 0 && mtb.length === 0) return null;

  return (
    <div>
      {heading ? (
        <h2 className="px-5 pt-6 font-display text-[15px] font-bold uppercase tracking-wider text-ink-soft">
          {heading}
        </h2>
      ) : null}
      <SportGroup title="Motorbike events" icon={Motorbike} sport="moto" events={moto} />
      <SportGroup title="Bicycle events" icon={Bike} sport="mtb" events={mtb} />
    </div>
  );
}

function SportGroup({
  title,
  icon: Icon,
  sport,
  events,
}: {
  title: string;
  icon: typeof Bike;
  sport: "moto" | "mtb";
  events: Event[];
}) {
  const [open, setOpen] = useState(true);
  if (events.length === 0) return null;
  return (
    <section>
      <div className="flex items-baseline justify-between px-5 pb-2 pt-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 font-display text-[15px] font-bold uppercase tracking-wider text-ink-soft active:opacity-70 transition"
        >
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-cherry-deep">
            <Icon className="h-3.5 w-3.5" />
          </span>
          {title}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        <Link to="/events" search={{ sport }} className="text-xs font-semibold text-cherry">
          See all →
        </Link>
      </div>

      <div
        className="overflow-hidden transition-[max-height,opacity] duration-300 ease-out"
        style={{ maxHeight: open ? "1200px" : "0px", opacity: open ? 1 : 0 }}
      >
        <ul className="space-y-2 px-5 pt-1">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                to="/my-events/$eventId"
                params={{ eventId: e.id }}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border active:scale-[0.99] transition-transform"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {e.logoUrl ? (
                    <img
                      src={e.logoUrl}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-xl bg-secondary object-contain p-1 ring-1 ring-border"
                    />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-cherry-deep">
                      <Icon className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-display text-[15px] font-bold text-ink">{e.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {formatDate(e.date)} · {e.location}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-cherry">{daysAway(e.date)}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-cherry">View →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
