import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageHeader, TypeBadge } from "@/components/ui-bits";
import { formatDate, formatTime } from "@/lib/mock-data";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import { MapPin, ChevronRight, Bike, Motorbike } from "lucide-react";
import { getEventSport, getEventSportLabel } from "@/lib/event-sport";
import { brandHeader } from "@/lib/event-brand";
import { EventLogo } from "@/components/event-logo";

type SportFilter = "all" | "moto" | "mtb";

export const Route = createFileRoute("/events/")({
  validateSearch: (search: Record<string, unknown>): { sport?: SportFilter } => {
    const s = search.sport;
    return s === "moto" || s === "mtb" || s === "all" ? { sport: s } : {};
  },
  head: () => ({
    meta: [
      { title: "Events — Red Cherry Events" },
      { name: "description", content: "Browse upcoming Red Cherry motorbike and mountain bike events." },
    ],
  }),
  component: Events,
});

function Events() {
  const hydrated = useHydratedStore();
  const { sport: sportParam } = Route.useSearch();
  const navigate = useNavigate({ from: "/events/" });
  const filter: SportFilter = sportParam ?? "all";
  const events = useAdminStore((s) => s.events)
    .filter((e) => (e.lifecycle ?? "published") === "published")
    .filter((e) => filter === "all" || getEventSport(e.discipline, e.name) === filter);

  return (
    <div>
      <PageHeader title="Events" subtitle="Upcoming races & rides" />
      <div className="flex gap-2 px-5 pt-4">
        {([
          { id: "all", label: "All" },
          { id: "moto", label: "Motorbike" },
          { id: "mtb", label: "Bicycle" },
        ] as { id: SportFilter; label: string }[]).map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => navigate({ search: (f.id === "all" ? {} : { sport: f.id }) as { sport?: SportFilter } })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                active ? "bg-cherry text-white ring-cherry" : "bg-card text-ink-soft ring-border"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      <ul className="space-y-3 px-5 py-5">
        {events.length === 0 ? (
          <li className="rounded-2xl bg-card p-6 text-center text-sm text-ink-soft ring-1 ring-border">
            No events in this category yet.
          </li>
        ) : null}
        {events.map((e) => {

          const sport = getEventSport(e.discipline, e.name);
          const SportIcon = sport === "moto" ? Motorbike : Bike;
          const sportLabel = getEventSportLabel(sport);
          return (
          <li key={e.id}>
            <Link
              to="/my-events/$eventId"
              params={{ eventId: e.id }}
              className="block overflow-hidden rounded-2xl bg-card ring-1 ring-border active:scale-[0.99] transition-transform"
            >
              <div style={brandHeader(e.heroColor).style} className={`relative overflow-hidden ${brandHeader(e.heroColor).className} px-4 py-4 text-white`}>
                {e.coverUrl ? (
                  <>
                    <img src={e.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </>
                ) : null}
                <div className="relative flex items-center justify-between">
                  <TypeBadge type={e.status} />
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest opacity-85">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30"
                      title={sportLabel}
                      aria-label={sportLabel}
                    >
                      <SportIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    {e.discipline}
                  </span>
                </div>
                <div className="relative mt-3 flex items-center justify-between gap-3">
                  <p className="min-w-0 font-display text-lg font-bold leading-tight">{e.name}</p>
                  <EventLogo src={e.logoUrl} name={e.name} size="md" onBrand />
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {formatDate(e.date)} · {formatTime(e.date)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {e.location} · {e.distanceKm}km
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {e.entered ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                      Entered
                    </span>
                  ) : null}
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </Link>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
