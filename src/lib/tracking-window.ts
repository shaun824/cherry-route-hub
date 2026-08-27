// When riders may share their position.
//
// House rules:
//  • Tracking opens 30 minutes before the first start of the day.
//  • Tracking closes as soon as the event's results are published, or at
//    18:00 local time — whichever comes first.
import type { Event } from "@/lib/mock-data";

export const OPEN_MINUTES_BEFORE_START = 30;
export const CLOSE_HOUR = 18; // 18:00 local
/** Used when the day has no published times yet. */
const FALLBACK_START = "06:00";

const TIME_RE = /^(\d{1,2}):(\d{2})/;
const START_WORDS = /(start|batch|wave|prologue|stage|depart|roll[- ]?out|race)/i;

export type TrackingWindow = {
  open: boolean;
  reason: "open" | "not-race-day" | "too-early" | "closed-time" | "closed-results";
  opensAt: Date | null;
  closesAt: Date | null;
  message: string;
};

function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function atTime(day: Date, hhmm: string) {
  const m = TIME_RE.exec(hhmm.trim());
  const d = new Date(day);
  d.setHours(m ? Number(m[1]) : 0, m ? Number(m[2]) : 0, 0, 0);
  return d;
}

function timeMinutes(value: string) {
  const m = TIME_RE.exec(value.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Earliest start time ("HH:MM") published for today, if any. */
function firstStartToday(event: Event | null | undefined, todayKey: string): string | null {
  if (!event) return null;
  const day = (event.days ?? []).find((d) => String(d.date ?? "").slice(0, 10) === todayKey);
  const items = (event.schedule ?? []).filter((i) => {
    if (day) return i.dayId === day.id;
    // Single-day event: every schedule item belongs to the event date.
    return !i.dayId;
  });
  const timed = items
    .map((i) => ({ mins: timeMinutes(i.time ?? ""), item: i }))
    .filter((x): x is { mins: number; item: (typeof items)[number] } => x.mins != null);
  if (timed.length === 0) return null;
  const starts = timed.filter((x) => START_WORDS.test(`${x.item.label} ${x.item.details ?? ""}`));
  const pool = starts.length > 0 ? starts : timed;
  const earliest = pool.reduce((a, b) => (a.mins <= b.mins ? a : b));
  return earliest.item.time;
}

function isRaceDay(event: Event | null | undefined, todayKey: string) {
  if (!event) return false;
  if (String(event.date ?? "").slice(0, 10) === todayKey) return true;
  return (event.days ?? []).some((d) => String(d.date ?? "").slice(0, 10) === todayKey);
}

export function trackingWindow(
  event: Event | null | undefined,
  opts: { resultsPublished?: boolean; now?: Date } = {},
): TrackingWindow {
  const now = opts.now ?? new Date();
  const todayKey = localDateKey(now);

  if (!isRaceDay(event, todayKey)) {
    return {
      open: false,
      reason: "not-race-day",
      opensAt: null,
      closesAt: null,
      message: "Live tracking opens on race day, 30 minutes before your start.",
    };
  }

  const start = atTime(now, firstStartToday(event, todayKey) ?? FALLBACK_START);
  const opensAt = new Date(start.getTime() - OPEN_MINUTES_BEFORE_START * 60_000);
  const closesAt = atTime(now, `${String(CLOSE_HOUR).padStart(2, "0")}:00`);
  const hhmm = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (opts.resultsPublished) {
    return {
      open: false,
      reason: "closed-results",
      opensAt,
      closesAt,
      message: "Your finish time is in — tracking has stopped.",
    };
  }
  if (now < opensAt) {
    return {
      open: false,
      reason: "too-early",
      opensAt,
      closesAt,
      message: `Tracking opens at ${hhmm(opensAt)} — 30 minutes before the ${hhmm(start)} start.`,
    };
  }
  if (now >= closesAt) {
    return {
      open: false,
      reason: "closed-time",
      opensAt,
      closesAt,
      message: `Tracking closed at ${hhmm(closesAt)}.`,
    };
  }
  return {
    open: true,
    reason: "open",
    opensAt,
    closesAt,
    message: `Tracking is open until ${hhmm(closesAt)}.`,
  };
}
