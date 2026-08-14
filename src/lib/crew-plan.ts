// Crew planning helpers: group an event's running order into real days and
// derive a crew timeline (call times, set-up windows, debrief) from it.
import type { EventDay, ScheduleItem } from "@/lib/mock-data";

export type ScheduleDay = {
  id: string;
  label: string;
  date?: string;
  items: ScheduleItem[];
};

/** Parse "07:30", "7h30", "7am", "18:00 - 19:00" → minutes after midnight. */
export function parseTime(raw: string | undefined): number | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  const m = t.match(/(\d{1,2})\s*[:h.]?\s*(\d{2})?\s*(am|pm)?/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (Number.isNaN(h) || Number.isNaN(min) || h > 23 || min > 59) return null;
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  return h * 60 + min;
}

export function formatTime(mins: number): string {
  const clamped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function dayLabel(day: EventDay | undefined, index: number, total: number): string {
  if (day?.label) return day.label;
  if (day?.date) {
    const d = new Date(day.date);
    if (!Number.isNaN(d.getTime()))
      return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
  }
  return total > 1 ? `Day ${index + 1}` : "Running order";
}

/**
 * Split the flat schedule into days using the event's `days` itinerary. Items
 * without a dayId land in their own "Unscheduled" group so nothing is lost.
 */
export function groupScheduleByDay(
  schedule: ScheduleItem[] | null | undefined,
  days: EventDay[] | null | undefined,
): ScheduleDay[] {
  const items = Array.isArray(schedule) ? schedule : [];
  const dayList = Array.isArray(days) ? days : [];
  if (!items.length) return [];

  const sortItems = (list: ScheduleItem[]) =>
    [...list].sort((a, b) => (parseTime(a.time) ?? 9999) - (parseTime(b.time) ?? 9999));

  const out: ScheduleDay[] = [];
  const ordered = [...dayList].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  ordered.forEach((d, i) => {
    const dayItems = items.filter((it) => it.dayId === d.id);
    if (!dayItems.length) return;
    out.push({
      id: d.id,
      label: dayLabel(d, i, ordered.length),
      ...(d.date ? { date: d.date } : {}),
      items: sortItems(dayItems),
    });
  });

  const dayIds = new Set(ordered.map((d) => d.id));
  const orphans = items.filter((it) => !it.dayId || !dayIds.has(it.dayId));
  if (orphans.length) {
    out.push({
      id: "__unassigned",
      label: out.length ? "Not on a day yet" : "Running order",
      items: sortItems(orphans),
    });
  }
  return out;
}

/** Pick the day matching today's date, else the first upcoming one, else the first. */
export function pickCurrentDay(groups: ScheduleDay[]): string {
  if (!groups.length) return "";
  const iso = new Date().toISOString().slice(0, 10);
  const today = groups.find((g) => (g.date ?? "").slice(0, 10) === iso);
  if (today) return today.id;
  const upcoming = groups.find((g) => (g.date ?? "") >= iso && g.date);
  return (upcoming ?? groups[0]).id;
}

export type CrewTask = {
  time: string;
  minutes: number | null;
  label: string;
  detail?: string;
  /** The running-order item this task supports. */
  anchor?: string;
  role: string;
};

type Rule = { test: RegExp; lead: number; label: string; role: string; detail?: string };

// Lead time (minutes before the rider-facing item) that crew need on site.
const RULES: Rule[] = [
  {
    test: /(registration|reg open|check[- ]?in|number collect|race pack|packet)/i,
    lead: 60,
    label: "Registration desk set up",
    role: "Registration",
    detail: "Tables, race packs, boards, card machine and signage in place.",
  },
  {
    test: /(briefing|rider talk|welcome)/i,
    lead: 30,
    label: "Briefing area & PA ready",
    role: "PA / Announcer",
    detail: "Mic, speakers and seating tested before riders arrive.",
  },
  {
    test: /(start|batch|seeding|call[- ]?up|neutral)/i,
    lead: 45,
    label: "Start chute, timing & marshals in position",
    role: "Start / Timing",
    detail: "Barriers, arch, timing mats live and marshals radio-checked.",
  },
  {
    test: /(finish|first (rider|finisher)|cut[- ]?off)/i,
    lead: 60,
    label: "Finish line & refreshments ready",
    role: "Finish",
    detail: "Timing, medals, water and medical standing by.",
  },
  {
    test: /(prize|podium|award|presentation)/i,
    lead: 45,
    label: "Podium, prizes & PA ready",
    role: "PA / Announcer",
    detail: "Prizes laid out, results confirmed, podium dressed.",
  },
  {
    test: /(breakfast|lunch|dinner|supper|meal|braai|catering)/i,
    lead: 45,
    label: "Catering & seating ready",
    role: "Catering",
    detail: "Serving line, seating and waste bins set.",
  },
  {
    test: /(water ?point|feed ?zone|refresh|aid station)/i,
    lead: 90,
    label: "Water points stocked and staffed",
    role: "Route",
    detail: "Stock loaded, vehicles dispatched to each point.",
  },
  {
    test: /(bag|luggage|kit drop|pack up|truck)/i,
    lead: 30,
    label: "Luggage crew and truck on standby",
    role: "Logistics",
  },
  {
    test: /(shuttle|transfer|bus|transport)/i,
    lead: 30,
    label: "Drivers and vehicles staged",
    role: "Transport",
  },
  {
    test: /(camp|village|tent|accommodation|rooming)/i,
    lead: 45,
    label: "Village desk manned & tents marked",
    role: "Village",
    detail: "Rooming list printed, zone signage up.",
  },
  {
    test: /(expo|market|stall|vendor|sponsor)/i,
    lead: 60,
    label: "Expo & sponsor activations open",
    role: "Village",
  },
];

/**
 * Build the crew timeline for one day: a call time, a set-up task ahead of each
 * item in the running order, and a debrief after the last item.
 */
export function buildCrewTimeline(day: ScheduleDay | undefined): CrewTask[] {
  if (!day?.items.length) return [];
  const timed = day.items
    .map((it) => ({ it, mins: parseTime(it.time) }))
    .filter((x): x is { it: ScheduleItem; mins: number } => x.mins !== null);

  const tasks: CrewTask[] = [];

  if (timed.length) {
    const first = Math.min(...timed.map((t) => t.mins));
    tasks.push({
      time: formatTime(first - 90),
      minutes: first - 90,
      label: "Crew call — all hands on site",
      detail: "Radios out, roles confirmed, quick stand-up before the day starts.",
      role: "All crew",
    });
  }

  for (const { it, mins } of timed) {
    const rule = RULES.find((r) => r.test.test(`${it.label} ${it.details ?? ""}`));
    const lead = rule?.lead ?? 15;
    tasks.push({
      time: formatTime(mins - lead),
      minutes: mins - lead,
      label: rule?.label ?? `Crew in position for ${it.label}`,
      ...(rule?.detail ? { detail: rule.detail } : {}),
      anchor: `${it.time} · ${it.label}`,
      role: rule?.role ?? "All crew",
    });
  }

  if (timed.length) {
    const last = Math.max(...timed.map((t) => t.mins));
    tasks.push({
      time: formatTime(last + 30),
      minutes: last + 30,
      label: "Sweep, pack down & crew debrief",
      detail: "Signage and gear recovered, issues logged for tomorrow.",
      role: "All crew",
    });
  }

  const untimed = day.items.filter((it) => parseTime(it.time) === null);
  for (const it of untimed) {
    const rule = RULES.find((r) => r.test.test(`${it.label} ${it.details ?? ""}`));
    tasks.push({
      time: it.time || "TBC",
      minutes: null,
      label: rule?.label ?? `Crew in position for ${it.label}`,
      ...(rule?.detail ? { detail: rule.detail } : {}),
      anchor: `${it.time || "TBC"} · ${it.label}`,
      role: rule?.role ?? "All crew",
    });
  }

  return tasks.sort((a, b) => (a.minutes ?? 99999) - (b.minutes ?? 99999));
}
