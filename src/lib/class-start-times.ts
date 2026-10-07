// Matches a rider's entry class to the "… riders start" rows in the event's published schedule,
// so start times always follow the schedule (no separate data to keep in sync).
import type { EventDay, ScheduleItem } from "@/lib/mock-data";

const TIERS = ["gold", "silver", "bronze"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function classStartTimes(
  category: string | null | undefined,
  schedule: ScheduleItem[] | undefined,
  days: EventDay[] | undefined,
): { dayLabel: string; time: string }[] {
  if (!category || !schedule?.length) return [];
  const c = category.toLowerCase();
  const ebike = /e-?bike/.test(c);
  const tier = TIERS.find((t) => c.includes(t));
  const dayById = new Map((days ?? []).map((d) => [d.id, d]));
  const onlyDay = WEEKDAYS.find((w) => c.includes(w));
  const out: { dayLabel: string; time: string; sort: string }[] = [];
  for (const s of schedule) {
    const l = s.label.toLowerCase();
    if (!/start/.test(l)) continue;
    if (/e-?bike/.test(l) !== ebike) continue;
    const lt = TIERS.find((t) => l.includes(t));
    if (tier ? lt !== tier : !!lt) continue;
    const day = s.dayId ? dayById.get(s.dayId) : undefined;
    if (onlyDay && day?.date) {
      const wd = WEEKDAYS[new Date(`${day.date}T12:00:00`).getDay()];
      if (wd !== onlyDay) continue;
    }
    const time = /^(\d{1,2}):(\d{2})/.exec(s.time.trim());
    if (!time) continue;
    out.push({
      dayLabel: day?.label ?? day?.date ?? "",
      time: `${time[1].padStart(2, "0")}:${time[2]}`,
      sort: `${day?.date ?? ""}${time[1].padStart(2, "0")}${time[2]}`,
    });
  }
  return out.sort((a, b) => a.sort.localeCompare(b.sort)).map(({ dayLabel, time }) => ({ dayLabel, time }));
}
