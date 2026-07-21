import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { TypeBadge } from "@/components/ui-bits";
import { feed, formatDate, formatTime, relativeTime } from "@/lib/mock-data";
import type { EventDay, EventRoute, ScheduleItem } from "@/lib/mock-data";
import { useAdminStore } from "@/lib/store";
import { RouteMap } from "@/components/route-map";
import { MessageSquare, ChevronRight, ExternalLink, Map as MapIcon, Maximize2 } from "lucide-react";

const DESCRIPTION_PREVIEW_LENGTH = 50;

export const Route = createFileRoute("/events/$eventId/")({
  component: EventDetailIndex,
});

function EventDetailIndex() {
  const { eventId } = Route.useParams();
  const event = useAdminStore((s) => s.events.find((e) => e.id === eventId));
  const entriesEnabled = useAdminStore((s) => s.settings.features.entriesEnabled);
  if (!event) {
    return (
      <div className="p-8 text-center text-sm text-ink-soft">
        Event not found.{" "}
        <Link to="/my-events" className="font-semibold text-cherry">Back</Link>
      </div>
    );
  }
  const eventPosts = feed.filter((p) => p.eventId === event.id);

  const description: string = event.description ?? "";
  const isLongDescription = description.length > DESCRIPTION_PREVIEW_LENGTH;
  const [descExpanded, setDescExpanded] = useState(false);

  const days: EventDay[] = event.days ?? [];
  const schedule: ScheduleItem[] = event.schedule ?? [];
  const scheduleDayIds = Array.from(
    new Set(
      schedule
        .map((s) => s.dayId)
        .filter((id): id is string => Boolean(id && days.some((d) => d.id === id))),
    ),
  );
  const scheduleDays = days.filter((d) => scheduleDayIds.includes(d.id));
  const hasUnscheduled = schedule.some((s) => !s.dayId || !days.some((d) => d.id === s.dayId));
  const scheduleTabs: { id: string; label: string; date?: string }[] = [
    ...scheduleDays.map((d, i) => ({ id: d.id, label: d.label || `Day ${i + 1}`, date: d.date })),
    ...(hasUnscheduled ? [{ id: "__unscheduled", label: "Other" }] : []),
  ];
  const [activeDayId, setActiveDayId] = useState<string | undefined>(scheduleTabs[0]?.id);
  const activeItems = schedule.filter((s) =>
    activeDayId === "__unscheduled"
      ? !s.dayId || !days.some((d) => d.id === s.dayId)
      : s.dayId === activeDayId,
  );

  return (
    <div>
      {/* Enter CTA / Entry Ninja handoff */}
      <div className="sticky top-0 z-10 -mt-3 px-5">
        <div className="rounded-2xl bg-card p-3 shadow-lg ring-1 ring-border">
          {entriesEnabled ? (
            event.entered ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-3">
                <span className="flex-1 text-sm font-bold text-emerald-900">✓ You're entered</span>
                <Link
                  to="/events/$eventId/enter"
                  params={{ eventId: event.id }}
                  className="text-xs font-semibold text-emerald-900 underline"
                >
                  Manage
                </Link>
              </div>
            ) : (
              <Link
                to="/events/$eventId/enter"
                params={{ eventId: event.id }}
                className="flex w-full items-center justify-center gap-1 rounded-xl cherry-gradient py-3 text-sm font-bold text-white shadow-md shadow-cherry/25 active:scale-[0.99] transition-transform"
              >
                Enter this event
                <ChevronRight className="h-4 w-4" />
              </Link>
            )
          ) : (
            <div className="space-y-2">
              <a
                href="https://entryninja.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl cherry-gradient py-3 text-sm font-bold text-white shadow-md shadow-cherry/25 active:scale-[0.99] transition-transform"
              >
                Enter on Entry Ninja
                <ExternalLink className="h-4 w-4" />
              </a>
              <p className="text-center text-[11px] text-muted-foreground">
                Already entered? See your event info in{" "}
                <Link to="/my-events" className="font-semibold text-cherry">
                  My Events
                </Link>
                .
              </p>
            </div>
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
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {isLongDescription && !descExpanded
            ? `${description.slice(0, DESCRIPTION_PREVIEW_LENGTH).trimEnd()}…`
            : description}
        </p>
        {isLongDescription ? (
          <button
            type="button"
            onClick={() => setDescExpanded((v) => !v)}
            className="mt-2 text-xs font-semibold text-cherry"
          >
            {descExpanded ? "Show less" : "Learn more"}
          </button>
        ) : null}
      </section>

      {/* Interactive route map */}
      {(event.days ?? []).some((d: EventDay) => (d.routes ?? []).some((r: EventRoute) => (r.kmlUrls ?? []).length > 0)) ? (
        <section className="px-5 pt-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
              <MapIcon className="h-3.5 w-3.5" /> Route map
            </h2>
            <Link
              to="/events/$eventId/map"
              params={{ eventId: event.id }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-cherry"
            >
              Fullscreen <Maximize2 className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-3">
            <RouteMap event={event} height="320px" />
          </div>
        </section>
      ) : null}

      {/* Days & routes */}
      {event.days && event.days.length > 0 ? (
        <section className="px-5 pt-6">
          <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
            Days & routes
          </h2>
          <div className="mt-3 space-y-4">
            {event.days.map((d: EventDay, di: number) => (
              <div key={d.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display text-base font-bold text-ink">
                    {d.label || `Day ${di + 1}`}
                  </p>
                  {d.date ? (
                    <span className="text-[11px] font-semibold text-ink-soft">{d.date}</span>
                  ) : null}
                </div>
                {d.routes.length === 0 ? (
                  <p className="mt-2 text-xs text-ink-soft">Routes to be announced.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {d.routes.map((r: EventRoute) => (
                      <li key={r.id} className="rounded-xl bg-background p-3 ring-1 ring-border">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              r.tier === "Gold"
                                ? "bg-amber-100 text-amber-800"
                                : r.tier === "Silver"
                                  ? "bg-slate-200 text-slate-800"
                                  : r.tier === "Bronze"
                                    ? "bg-orange-100 text-orange-900"
                                    : "bg-secondary text-ink-soft"
                            }`}
                          >
                            {r.tier}
                          </span>
                          <span className="text-sm font-semibold text-ink">{r.name}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-ink-soft">
                          {r.distanceKm ? `${r.distanceKm} km` : ""}
                          {r.elevationM ? ` · ${r.elevationM} m elevation` : ""}
                        </p>
                        {r.description ? (
                          <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                            {r.description}
                          </p>
                        ) : null}
                        {r.gpxUrl ? (
                          <a
                            href={r.gpxUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-cherry"
                          >
                            Download GPX <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Schedule */}
      {schedule.length > 0 ? (
        <section className="px-5 pt-6">
          <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
            Schedule
          </h2>
          {scheduleTabs.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {scheduleTabs.map((tab) => {
                const active = tab.id === activeDayId;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveDayId(tab.id)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ring-1 ${
                      active
                        ? "bg-cherry text-white ring-cherry shadow-sm"
                        : "bg-card text-ink-soft ring-border hover:text-ink"
                    }`}
                  >
                    {tab.label}
                    {tab.date ? (
                      <span className={`ml-1.5 text-[10px] ${active ? "text-white/80" : "text-muted-foreground"}`}>
                        {tab.date}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          <ol key={activeDayId} className="mt-3 space-y-2 animate-fade-in">
            {activeItems.length === 0 ? (
              <li className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Nothing scheduled for this day yet.
              </li>
            ) : (
              activeItems.map((s: ScheduleItem, i: number) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-border"
                >
                  <span className="mt-0.5 rounded-md bg-accent px-2 py-1 font-mono text-[11px] font-bold text-cherry-deep">
                    {s.time}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{s.label}</p>
                    {s.details ? (
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink-soft">
                        {s.details}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ol>
        </section>
      ) : null}

      {/* Location */}
      <section className="px-5 pt-6">
        <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
          Location
        </h2>
        {event.mapQuery || event.location ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.mapQuery || event.location)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block overflow-hidden rounded-2xl ring-1 ring-border"
          >
            <iframe
              title="Event venue map"
              src={`https://www.google.com/maps?q=${encodeURIComponent(event.mapQuery || event.location)}&output=embed`}
              className="pointer-events-none h-44 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="flex items-center justify-between bg-card px-3 py-2 text-xs">
              <span className="font-semibold text-ink">{event.mapQuery || event.location}</span>
              <span className="font-semibold text-cherry">Navigate ↗</span>
            </div>
          </a>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-border p-4 text-center text-xs text-ink-soft">
            No venue set yet.
          </div>
        )}
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
