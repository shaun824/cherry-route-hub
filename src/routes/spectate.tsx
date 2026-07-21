import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Binoculars, CalendarDays, ChevronRight, Lock, MapPin } from "lucide-react";
import { PageHeader } from "@/components/ui-bits";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import { formatDate, formatTime } from "@/lib/mock-data";
import type { Event } from "@/lib/mock-data";

export const Route = createFileRoute("/spectate")({
  head: () => ({
    meta: [
      { title: "Spectate — Red Cherry Events" },
      { name: "description", content: "Follow Red Cherry rides as a spectator. Events unlock closer to race day." },
      { property: "og:title", content: "Spectate — Red Cherry Events" },
      { property: "og:description", content: "Follow Red Cherry rides as a spectator. Events unlock closer to race day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpectatePage,
});

type Filter = "upcoming" | "live";

function SpectatePage() {
  useHydratedStore();
  const events = useAdminStore((s) => s.events);
  const [filter, setFilter] = useState<Filter>("upcoming");

  const visible = useMemo(() => {
    const list = events.filter((e) => (e.lifecycle ?? "published") !== "archived");
    const now = Date.now();
    const bucket = (e: Event) => (e.status === "live" ? "live" : "upcoming");
    return list
      .filter((e) => bucket(e) === filter)
      .sort((a, b) => {
        const at = new Date(a.date).getTime();
        const bt = new Date(b.date).getTime();
        // Nearest upcoming first; live-first for live tab.
        if (filter === "live") return at - bt;
        return Math.abs(at - now) - Math.abs(bt - now);
      });
  }, [events, filter]);

  return (
    <div>
      <PageHeader title="Spectate" subtitle="Follow the ride from the sidelines" />

      <div className="mx-5 mt-4 flex gap-2">
        {(["upcoming", "live"] as Filter[]).map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ring-1 ${
                active
                  ? "bg-cherry text-white ring-cherry"
                  : "bg-card text-ink-soft ring-border"
              }`}
            >
              {f === "live" ? "Live now" : "Upcoming"}
            </button>
          );
        })}
      </div>

      <ul className="mx-5 mt-4 space-y-3">
        {visible.length === 0 ? (
          <li className="rounded-2xl bg-card p-6 text-center text-sm text-ink-soft ring-1 ring-border">
            {filter === "live"
              ? "No events are live right now. Check back on race day."
              : "No upcoming events to spectate yet."}
          </li>
        ) : (
          visible.map((e) => <SpectatorCard key={e.id} event={e} />)
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

function SpectatorCard({ event }: { event: Event }) {
  const unlocked = Boolean(event.spectatorMode);
  const countdown = useCountdown(event.date);

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
      <p className="text-[10px] font-bold uppercase tracking-widest text-cherry">
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
              {countdown ?? "Details available"}
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
