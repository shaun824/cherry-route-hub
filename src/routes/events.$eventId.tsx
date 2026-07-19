import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { TypeBadge } from "@/components/ui-bits";
import { events, feed, formatDate, formatTime, relativeTime } from "@/lib/mock-data";
import { ArrowLeft, MapPin, Clock, Route as RouteIcon, ExternalLink, MessageSquare } from "lucide-react";

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
  component: EventDetail,
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <p className="text-ink">Event not found.</p>
      <Link to="/events" className="mt-4 inline-block text-cherry font-semibold">
        Back to events
      </Link>
    </div>
  ),
});

function EventDetail() {
  const { event } = Route.useLoaderData();
  const eventPosts = feed.filter((p) => p.eventId === event.id);

  return (
    <div>
      {/* Hero */}
      <div
        className={`relative overflow-hidden bg-gradient-to-br ${event.heroColor} px-5 pb-6 text-white`}
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 3.5rem)" }}
      >
        <Link
          to="/events"
          aria-label="Back"
          className="absolute left-4 top-14 grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur"
          style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex items-center gap-2">
          <TypeBadge type={event.status} />
          <span className="text-[11px] font-semibold uppercase tracking-widest opacity-85">
            {event.discipline}
          </span>
        </div>
        <h1 className="relative mt-3 font-display text-2xl font-bold leading-tight">
          {event.name}
        </h1>
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

      {/* Enter CTA */}
      <div className="sticky top-0 z-10 -mt-3 px-5">
        <div className="rounded-2xl bg-card p-3 shadow-lg ring-1 ring-border">
          {event.entered ? (
            <button
              disabled
              className="w-full rounded-xl bg-emerald-100 py-3 text-sm font-bold text-emerald-900"
            >
              ✓ You're entered
            </button>
          ) : (
            <button className="w-full rounded-xl cherry-gradient py-3 text-sm font-bold text-white shadow-md shadow-cherry/25 active:scale-[0.99] transition-transform">
              Enter on Entry Ninja
              <ExternalLink className="ml-2 inline h-4 w-4" />
            </button>
          )}
          {event.externalId ? (
            <p className="mt-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
              Entry Ninja ID · {event.externalId}
            </p>
          ) : null}
        </div>
      </div>

      {/* About */}
      <section className="px-5 pt-6">
        <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
          About this event
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{event.description}</p>
      </section>

      {/* Schedule */}
      <section className="px-5 pt-6">
        <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
          Schedule
        </h2>
        <ol className="mt-3 space-y-2">
          {event.schedule.map((s: { time: string; label: string }, i: number) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-border"
            >
              <span className="mt-0.5 rounded-md bg-accent px-2 py-1 font-mono text-[11px] font-bold text-cherry-deep">
                {s.time}
              </span>
              <span className="text-sm text-ink">{s.label}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Location / Map placeholder */}
      <section className="px-5 pt-6">
        <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
          Location
        </h2>
        <div className="relative mt-3 h-44 overflow-hidden rounded-2xl ring-1 ring-border">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 40%, oklch(0.9 0.02 260) 0, transparent 60%), radial-gradient(circle at 70% 60%, oklch(0.92 0.03 25) 0, transparent 60%), linear-gradient(180deg, oklch(0.96 0.005 260), oklch(0.92 0.01 260))",
            }}
          />
          <svg viewBox="0 0 300 180" className="absolute inset-0 h-full w-full">
            <path
              d="M20 140 Q 80 40 150 90 T 280 60"
              stroke="oklch(0.585 0.235 25)"
              strokeWidth="3"
              strokeDasharray="6 4"
              fill="none"
            />
            <circle cx="20" cy="140" r="6" fill="oklch(0.585 0.235 25)" />
            <circle cx="280" cy="60" r="6" fill="oklch(0.2 0.02 260)" />
          </svg>
          <div className="absolute inset-x-3 bottom-3 rounded-xl bg-card/95 px-3 py-2 text-xs ring-1 ring-border backdrop-blur">
            <p className="font-semibold text-ink">{event.mapQuery}</p>
            <p className="text-muted-foreground">Tap to open in Maps</p>
          </div>
        </div>
      </section>

      {/* Event-specific comms */}
      <section className="px-5 pb-8 pt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
            Comms hub
          </h2>
          <Link to="/feed" className="text-xs font-semibold text-cherry">
            All updates →
          </Link>
        </div>
        {eventPosts.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center">
            <MessageSquare className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">No announcements yet.</p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {eventPosts.map((p) => (
              <li key={p.id} className="rounded-xl bg-card p-3 ring-1 ring-border">
                <div className="flex items-center gap-2">
                  <TypeBadge type={p.type} />
                  <span className="text-[11px] text-muted-foreground">
                    {relativeTime(p.postedAt)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-ink">{p.title}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{p.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
