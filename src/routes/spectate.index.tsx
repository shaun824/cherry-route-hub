import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Binoculars, CalendarDays, ChevronRight, History, Lock, MapPin } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/ui-bits";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import { formatDate, formatTime } from "@/lib/mock-data";
import { getEventRiders, ROSTER_WINDOW_DAYS } from "@/lib/results.functions";
import { useIsAdmin, useSession } from "@/lib/auth";
import { getEventTypeIcon } from "@/lib/event-type-icon";
import { groupSpectateEvents } from "@/lib/spectate-groups";
import type { Event } from "@/lib/mock-data";

export const Route = createFileRoute("/spectate/")({
  head: () => ({
    meta: [
      { title: "Track riders — Red Cherry Events" },
      {
        name: "description",
        content:
          "Follow Red Cherry rides as a spectator: events that have just finished this year, and everything still to come.",
      },
      { property: "og:title", content: "Track riders — Red Cherry Events" },
      {
        property: "og:description",
        content:
          "Follow Red Cherry rides as a spectator: events that have just finished this year, and everything still to come.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpectatePage,
});

function SpectatePage() {
  useHydratedStore();
  const events = useAdminStore((s) => s.events);
  const { past, upcoming } = useMemo(() => groupSpectateEvents(events), [events]);

  // Preload rider rosters for signed-in riders so race-week lists open instantly.
  const { user } = useSession();
  const queryClient = useQueryClient();
  const fetchRiders = useServerFn(getEventRiders);
  useEffect(() => {
    if (!user) return;
    const now = Date.now();
    const soon = events
      .filter((e) => {
        const t = new Date(e.date).getTime();
        return t - now <= ROSTER_WINDOW_DAYS * 86400000 && t + 3 * 86400000 >= now;
      })
      .slice(0, 3);
    for (const e of soon) {
      void queryClient.prefetchQuery({
        queryKey: ["event-riders", e.id, user.id],
        queryFn: () => fetchRiders({ data: { eventId: e.id } }),
        staleTime: 60_000,
      });
    }
  }, [events, user, queryClient, fetchRiders]);

  return (
    <div>
      <PageHeader title="Track riders" subtitle="Rider lists, bib numbers and results" />

      {past.length > 0 ? (
        <>
          <SectionBar
            title="Just past"
            note={`${past.length} ${past.length === 1 ? "event" : "events"} this year`}
            icon={<History className="h-3.5 w-3.5" />}
          />
          <ul className="mx-5 grid gap-2 lg:grid-cols-2">
            {past.map((e) => (
              <PastRow key={e.id} event={e} />
            ))}
          </ul>
        </>
      ) : null}

      <SectionBar
        title="Coming up"
        note={upcoming.length > 0 ? `${upcoming.length} ${upcoming.length === 1 ? "event" : "events"}` : undefined}
        icon={<CalendarDays className="h-3.5 w-3.5" />}
      />

      <ul className="mx-5 grid gap-3 lg:grid-cols-2">
        {upcoming.length === 0 ? (
          <li className="rounded-2xl bg-card p-6 text-center text-sm text-ink-soft ring-1 ring-border">
            Nothing is scheduled yet. Check back soon.
          </li>
        ) : (
          upcoming.map((e) => <SpectatorCard key={e.id} event={e} />)
        )}
      </ul>

      <div className="mx-5 mt-6 flex items-start gap-2 rounded-2xl bg-card p-4 text-xs text-ink-soft ring-1 ring-border">
        <Binoculars className="mt-0.5 h-4 w-4 shrink-0 text-cherry" />
        <p>
          Event pages unlock as race day approaches. Once open, you'll see the venue, schedule, routes, and how to follow along.
        </p>
      </div>

      <div className="h-6" />
    </div>
  );
}

/** Heading bar above each list: title on the left, how many on the right. */
function SectionBar({
  title,
  note,
  icon,
}: {
  title: string;
  note?: string;
  icon: ReactNode;
}) {
  return (
    <div className="mx-5 mt-6 flex items-center gap-2 rounded-xl bg-accent px-3 py-2 ring-1 ring-border">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-card text-cherry-deep">
        {icon}
      </span>
      <h2 className="min-w-0 truncate font-display text-sm font-bold uppercase tracking-widest text-ink">
        {title}
      </h2>
      {note ? (
        <span className="ml-auto shrink-0 text-[11px] font-semibold text-ink-soft">{note}</span>
      ) : null}
    </div>
  );
}

/** Compact finished-event row: date, name, type icon on the right. */
function PastRow({ event }: { event: Event }) {
  const { isAdmin } = useIsAdmin();
  const unlocked = Boolean(event.spectatorMode) || isAdmin;
  const { Icon, label } = getEventTypeIcon(event.discipline, event.name);
  const day = new Date(event.date).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

  const inner = (
    <div className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5 ring-1 ring-border">
      <div className="w-12 shrink-0 text-center">
        <p className="text-sm font-bold leading-none text-ink">{day}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{event.name}</p>
        <p className="mt-0.5 truncate text-[11px] text-ink-soft">
          {label}
          {event.location ? ` · ${event.location}` : ""}
        </p>
      </div>
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-cherry-deep"
        title={label}
        aria-label={label}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
    </div>
  );

  return (
    <li className="min-w-0">
      {unlocked ? (
        <Link to="/spectate/$eventId" params={{ eventId: event.id }} className="block">
          {inner}
        </Link>
      ) : (
        <div aria-disabled className="block cursor-default">
          {inner}
        </div>
      )}
    </li>
  );
}


function SpectatorCard({ event }: { event: Event }) {
  // Admins can open any event's track page, even before it unlocks publicly.
  const { isAdmin } = useIsAdmin();
  const unlocked = Boolean(event.spectatorMode) || isAdmin;
  const adminPreview = !event.spectatorMode && isAdmin;
  const countdown = useCountdown(event.date);
  const { Icon, label } = getEventTypeIcon(event.discipline, event.name);

  const inner = (
    <div
      className={`relative overflow-hidden rounded-2xl bg-card p-4 ring-1 ring-border transition-colors ${
        unlocked ? "hover:ring-cherry/40" : "opacity-90"
      }`}
    >
      {event.status === "live" ? (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-cherry px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
        </span>
      ) : null}
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-cherry">
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-cherry-deep"
          title={label}
          aria-label={label}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
        </span>
        {event.discipline}
      </p>
      <h2 className="mt-1 font-display text-base font-bold text-ink">{event.name}</h2>
      <div className="mt-2 space-y-1 text-xs text-ink-soft">
        <p className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDate(event.date)} · {formatTime(event.date)}
        </p>
        {event.location ? (
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {event.location}
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between">
        {unlocked ? (
          <>
            <span className="text-xs font-semibold text-ink">
              {adminPreview ? "Admin preview" : (countdown ?? "Details available")}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-cherry">
              View details <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft">
              <Lock className="h-3.5 w-3.5" />
              Opens closer to race day
            </span>
            <span className="text-xs font-semibold text-ink-soft">{countdown ?? ""}</span>
          </>
        )}
      </div>
    </div>
  );

  return (
    <li>
      {unlocked ? (
        <Link to="/spectate/$eventId" params={{ eventId: event.id }} className="block">
          {inner}
        </Link>
      ) : (
        <div aria-disabled className="block cursor-not-allowed">
          {inner}
        </div>
      )}
    </li>
  );
}

function useCountdown(iso: string): string | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const target = new Date(iso).getTime();
  if (!Number.isFinite(target)) return null;
  const diff = target - Date.now();
  if (diff <= 0) return "Underway";
  const mins = Math.floor(diff / 60_000);
  const days = Math.floor(mins / (60 * 24));
  const hours = Math.floor((mins % (60 * 24)) / 60);
  if (days > 0) return `In ${days}d ${hours}h`;
  if (hours > 0) return `In ${hours}h ${mins % 60}m`;
  return `In ${mins}m`;
}
