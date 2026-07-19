import { createFileRoute, Link, notFound, Outlet } from "@tanstack/react-router";
import { events, formatDate, formatTime } from "@/lib/mock-data";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import { ArrowLeft, Clock, MapPin, Route as RouteIcon } from "lucide-react";

export const Route = createFileRoute("/events/$eventId")({
  loader: ({ params }) => {
    const event = events.find((e) => e.id === params.eventId);
    if (!event) throw notFound();
    return { event };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.event.name} — Red Cherry Events` },
          { name: "description", content: loaderData.event.description },
        ]
      : [{ title: "Event — Red Cherry Events" }],
  }),
  component: EventLayout,
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <p className="text-ink">Event not found.</p>
      <Link to="/events" className="mt-4 inline-block text-cherry font-semibold">
        Back to events
      </Link>
    </div>
  ),
});

function EventLayout() {
  useHydratedStore();
  const { event: loaderEvent } = Route.useLoaderData();
  const storeEvent = useAdminStore((s) => s.events.find((e) => e.id === loaderEvent.id));
  const event = storeEvent ?? loaderEvent;

  return (
    <div>
      {/* Hero */}
      <div
        className={`relative overflow-hidden bg-gradient-to-br ${event.heroColor} px-5 pb-6 text-white`}
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 3.5rem)" }}
      >
        {event.coverUrl ? (
          <>
            <img
              src={event.coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          </>
        ) : null}
        <Link
          to="/events"
          aria-label="Back"
          className="absolute left-4 top-14 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur"
          style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex items-center gap-3">
          {event.logoUrl ? (
            <img
              src={event.logoUrl}
              alt={`${event.name} logo`}
              className="h-14 w-14 shrink-0 rounded-xl bg-white/10 object-contain p-1.5 ring-1 ring-white/25 backdrop-blur"
            />
          ) : null}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <TypeBadge type={event.status} />
              <span className="text-[11px] font-semibold uppercase tracking-widest opacity-85">
                {event.discipline}
              </span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold leading-tight">
              {event.name}
            </h1>
          </div>
        </div>
        <div className="relative mt-4 space-y-1 text-sm">
          <p className="flex items-center gap-2">
            <Clock className="h-4 w-4 opacity-80" />
            {formatDate(event.date)} · {formatTime(event.date)}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 opacity-80" /> {event.location}
          </p>
          <p className="flex items-center gap-2">
            <RouteIcon className="h-4 w-4 opacity-80" /> {event.distanceKm} km
          </p>
        </div>
      </div>

      <Outlet />
    </div>
  );
}

function TypeBadge({ type }: { type: "open" | "closed" | "live" | "upcoming" }) {
  const styles = {
    open: "bg-emerald-100 text-emerald-900",
    closed: "bg-slate-100 text-slate-700",
    live: "bg-cherry text-white",
    upcoming: "bg-accent text-ink",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[type]}`}
    >
      {type}
    </span>
  );
}
