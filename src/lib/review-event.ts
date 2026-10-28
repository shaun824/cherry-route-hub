// App Store / Google Play review event helpers.
// A review event (events.is_review_event) is private to its entrants and is
// always "live": its dates are moved to the viewer's today and the start is
// set 15 minutes from now, so reviewers anywhere in the world can test
// countdowns, tracking, SOS and check-in. Applied on read only; the stored
// event row never changes.

export const REVIEW_START_LEAD_MIN = 15;
export const REVIEW_SOS_AUTO_RESOLVE_MIN = 10;
export const REVIEW_EVENT_NOTE =
  "Test event for app review. Tracking and SOS here are simulated and do not contact real emergency services.";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function localDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function hhmm(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Start time the reviewer sees: 15 minutes from now, rounded up to the minute. */
export function reviewStartAt(now: Date = new Date()): Date {
  const d = new Date(now.getTime() + REVIEW_START_LEAD_MIN * 60_000);
  d.setSeconds(0, 0);
  return d;
}

type Item = { time?: string; label?: string; dayId?: string; [k: string]: unknown };
type DayLike = { date?: string | null; [k: string]: unknown };

/**
 * Rewrites the date fields of an event (works with DB rows that use
 * `event_date` and app objects that use `date`) so it is always race day.
 */
export function liveReviewEvent<T extends Record<string, unknown>>(ev: T, now: Date = new Date()): T {
  const start = reviewStartAt(now);
  const opens = new Date(start.getTime() - 30 * 60_000);
  const today = localDateKey(now);
  const days = Array.isArray(ev.days)
    ? (ev.days as DayLike[]).map((d) => (d && typeof d === "object" ? { ...d, date: today } : d))
    : ev.days;
  const schedule = Array.isArray(ev.schedule)
    ? (ev.schedule as Item[]).map((i) => {
        if (!i || typeof i !== "object") return i;
        const isStart = /start/i.test(String(i.label ?? ""));
        return { ...i, time: hhmm(isStart ? start : opens) };
      })
    : ev.schedule;
  const batches = Array.isArray(ev.batches)
    ? (ev.batches as Record<string, unknown>[]).map((b) => (b && typeof b === "object" ? { ...b, startTime: hhmm(start) } : b))
    : ev.batches;
  const out: Record<string, unknown> = { ...ev, days, schedule, batches, status: "live" };
  if ("event_date" in ev) out.event_date = start.toISOString();
  if ("date" in ev) out.date = start.toISOString();
  return out as T;
}

export function isReviewRow(ev: unknown): boolean {
  if (!ev || typeof ev !== "object") return false;
  const r = ev as { is_review_event?: unknown; isReviewEvent?: unknown };
  return r.is_review_event === true || r.isReviewEvent === true;
}
