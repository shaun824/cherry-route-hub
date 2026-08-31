// Shared visibility rule for admin/crew ("backend") event lists.
// An event stays visible while it is upcoming, happening, or ended within the
// last BACKEND_HIDE_AFTER_DAYS days. Older events are hidden from pickers and
// lists so day-to-day screens stay uncluttered. Direct links to a specific
// event still work — this only filters lists.

const DAY_MS = 24 * 60 * 60 * 1000;

export const BACKEND_HIDE_AFTER_DAYS = 7;

type EventLike = { event_date?: string | null; date?: string | null; days?: unknown[] | null };

/** When the event ends (start date + extra days for multi-day events). */
export function eventEndMs(ev: EventLike): number {
  const raw = ev.event_date ?? ev.date ?? null;
  const t = raw ? new Date(raw).getTime() : Number.NaN;
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY; // unknown date → keep visible
  const extraDays = Array.isArray(ev.days) && ev.days.length > 0 ? ev.days.length - 1 : 0;
  return t + extraDays * DAY_MS;
}

/** True when the event ended more than BACKEND_HIDE_AFTER_DAYS ago. */
export function isHiddenFromBackend(ev: EventLike, now: number = Date.now()): boolean {
  return eventEndMs(ev) < now - BACKEND_HIDE_AFTER_DAYS * DAY_MS;
}

/** Filter helper for list query results. */
export function visibleInBackend<T extends EventLike>(events: T[], now?: number): T[] {
  return events.filter((e) => !isHiddenFromBackend(e, now));
}
