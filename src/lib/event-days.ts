// Red Cherry house rule: on almost every event the first day on the itinerary
// is registration/arrival day — riding starts the next morning. Schedules that
// come in from scrapes, imports or quick admin edits often label it "Day 1",
// which pushes every riding day one number out. This helper corrects generic
// labels at display time so the numbering is right everywhere, without
// touching days that are explicitly named (Arrival, Prologue, Trip 1 - Day 1…).
import type { EventDay, ScheduleItem } from "@/lib/mock-data";

const GENERIC_DAY = /^\s*day\s*(\d+)\s*$/i;
const REG_WORDS = /(registration|register|arrival|arrive|check[- ]?in|briefing|welcome)/i;
const RIDE_WORDS = /(start|batch|stage|race|prologue|lap|practice|time trial|neutral)/i;

export const REGISTRATION_LABEL = "Registration Day";

function isGeneric(label: string | undefined) {
  return !label || !label.trim() || GENERIC_DAY.test(label);
}

/** Does the itinerary's first day look like a registration day rather than a riding day? */
function firstDayIsRegistration(firstDayId: string | undefined, schedule: ScheduleItem[]) {
  const items = schedule.filter((i) => i.dayId && i.dayId === firstDayId);
  // No schedule detail yet: fall back to the house rule.
  if (!items.length) return true;
  const text = items.map((i) => `${i.label} ${i.details ?? ""}`).join(" ");
  if (RIDE_WORDS.test(text) && !REG_WORDS.test(text)) return false;
  // Riding starts on day one (e.g. weekend events) → leave the numbering alone.
  if (/\b(start|batch)\b/i.test(text)) return false;
  return REG_WORDS.test(text);
}

/**
 * Return the event days with corrected labels: the first day becomes
 * "Registration Day" and the riding days are renumbered from 1.
 * Days with bespoke labels are always left exactly as the admin wrote them.
 */
export function withRegistrationDayLabels(
  days: EventDay[] | null | undefined,
  schedule: ScheduleItem[] | null | undefined,
): EventDay[] {
  const list = Array.isArray(days) ? days : [];
  if (list.length < 2) return list;
  const items = Array.isArray(schedule) ? schedule : [];

  const ordered = [...list].sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
  // Only step in when the labels are the auto-generated kind.
  if (!ordered.every((d) => isGeneric(d.label))) return list;
  // A day with riding routes on it is never a registration-only day.
  if ((ordered[0]?.routes ?? []).length > 0) return list;
  if (!firstDayIsRegistration(ordered[0]?.id, items)) return list;


  const relabelled = new Map<string, string>();
  ordered.forEach((d, i) => {
    relabelled.set(d.id, i === 0 ? REGISTRATION_LABEL : `Day ${i}`);
  });
  return list.map((d) => ({ ...d, label: relabelled.get(d.id) ?? d.label }));
}
