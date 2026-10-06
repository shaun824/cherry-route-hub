import { Link } from "@tanstack/react-router";
import { Radio, Trophy } from "lucide-react";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Race week runs from 7 days before the event starts until the end of its
 * last day (multi-day events use the days array length).
 */
export function isRaceWeek(
  eventDate: string | null | undefined,
  days?: unknown,
  now: number = Date.now(),
): boolean {
  if (!eventDate) return false;
  const start = new Date(eventDate).getTime();
  if (!Number.isFinite(start)) return false;
  const extraDays = Array.isArray(days) && days.length > 0 ? days.length - 1 : 0;
  const end = start + extraDays * DAY_MS + DAY_MS; // through the last day
  return now >= start - 7 * DAY_MS && now <= end;
}

/**
 * Race-week module: pushes riders and spectators to the live tracking and
 * results page. Shown on the home screen and the event page during race week.
 */
export function RaceWeekBanner({
  eventId,
  eventName,
  eventDate,
  days,
}: {
  eventId: string;
  eventName: string;
  eventDate: string | null | undefined;
  days?: unknown;
}) {
  if (!isRaceWeek(eventDate, days)) return null;
  const start = new Date(eventDate!).getTime();
  const started = Date.now() >= start;

  return (
    <Link
      to="/spectate/$eventId"
      params={{ eventId }}
      className="block rounded-2xl border border-cherry/30 bg-cherry/5 p-4 shadow-sm transition active:scale-[0.99]"
      data-track-action="race_week_banner"
    >
      <div className="flex items-center gap-3">
        <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cherry text-white">
          <Radio className="h-5 w-5" />
          {started ? (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-green-500 ring-2 ring-card" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-cherry">
            {started ? "Live now" : "Race week"}
          </p>
          <p className="truncate font-display text-sm font-bold text-ink">
            {eventName}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {started
              ? "Follow riders live on the map and see results as they come in."
              : "Tracking and results go live here — follow your riders on race day."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-cherry px-3 py-1.5 text-xs font-semibold text-white">
          <Trophy className="h-3.5 w-3.5" />
          Track
        </div>
      </div>
    </Link>
  );
}
