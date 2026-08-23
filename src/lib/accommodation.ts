// Night-by-night accommodation. Events that move sleep at a different venue
// each night, so a rider needs "which venue + which tent, per night" rather
// than one allocation for the whole event.
import { supabase } from "@/integrations/supabase/client";
import { withSnapshot } from "@/lib/offline-pack";
import { withRegistrationDayLabels } from "@/lib/event-days";
import { ROOMING_COLUMNS, type RoomingRow, type Venue } from "@/lib/rooming";
import type { EventDay, ScheduleItem } from "@/lib/mock-data";

export type NightStay = {
  /** 1-based night number for the event */
  index: number;
  /** ISO date of the evening the rider sleeps (the day they arrive at the venue) */
  date: string | null;
  /** Label of the day that precedes this night, e.g. "Registration Day" */
  dayLabel: string | null;
  venue: Venue | null;
  allocation: RoomingRow | null;
};

/** Nights are the evenings between event days — you sleep after every day but the last. */
export function eventNights(
  rawDays: EventDay[] | null | undefined,
  schedule: ScheduleItem[] | null | undefined,
): { index: number; date: string | null; dayLabel: string | null }[] {
  const days = withRegistrationDayLabels(rawDays ?? [], schedule ?? []);
  const ordered = [...days].sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
  if (ordered.length < 2) return [];
  return ordered.slice(0, -1).map((d, i) => ({
    index: i + 1,
    date: d.date ?? null,
    dayLabel: d.label ?? `Day ${i + 1}`,
  }));
}

function venueCoversNight(v: Venue, night: number, totalNights: number, multiVenue: boolean) {
  if (!multiVenue) return true;
  const start = v.night_start ?? 1;
  const count = v.nights ?? Math.max(1, totalNights - start + 1);
  return night >= start && night < start + count;
}

/**
 * Build the rider's night-by-night stay list. `myRows` are the rider's own
 * rooming allocations (usually one per venue). A row with `night_index` set
 * only applies to that night; otherwise it applies to every night its venue covers.
 */
export function buildNights({
  days,
  schedule,
  venues,
  myRows,
}: {
  days: EventDay[] | null | undefined;
  schedule: ScheduleItem[] | null | undefined;
  venues: Venue[];
  myRows: RoomingRow[];
}): NightStay[] {
  const nights = eventNights(days, schedule);
  if (nights.length === 0) return [];
  const multiVenue = venues.length > 1 || venues.some((v) => v.night_start != null);
  const total = nights.length;

  return nights.map((n) => {
    const venue =
      venues.find((v) => venueCoversNight(v, n.index, total, multiVenue)) ?? venues[0] ?? null;
    const forNight = myRows.filter(
      (r) => r.night_index === n.index && (!venue || !r.venue_id || r.venue_id === venue.id),
    );
    const forVenue = venue
      ? myRows.filter((r) => r.night_index == null && r.venue_id === venue.id)
      : [];
    const anyRow = myRows.filter((r) => r.night_index == null && !r.venue_id);
    return {
      ...n,
      venue,
      allocation: forNight[0] ?? forVenue[0] ?? (multiVenue ? null : (anyRow[0] ?? myRows[0] ?? null)),
    };
  });
}

/** Every rooming allocation belonging to the signed-in rider for an event. */
export async function fetchMyRoomingRows(eventId: string): Promise<RoomingRow[]> {
  return withSnapshot(
    `my-rooming-rows:${eventId}`,
    () => fetchMyRoomingRowsLive(eventId),
    (v) => v.length === 0,
  );
}

async function fetchMyRoomingRowsLive(eventId: string): Promise<RoomingRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const email = auth.user?.email?.toLowerCase() ?? null;

  const { data, error } = await supabase
    .from("event_rooming")
    .select(ROOMING_COLUMNS)
    .eq("event_id", eventId);
  if (error) {
    console.warn("[accommodation] rooming", error);
    return [];
  }
  const rows = (data ?? []) as unknown as RoomingRow[];
  if (rows.length === 0) return [];

  const { data: mine } = await supabase.from("entrants").select("id").eq("user_id", uid);
  const entrantIds = new Set((mine ?? []).map((e) => e.id));

  const myEntryIds = new Set<string>();
  if (entrantIds.size) {
    const { data: entries } = await supabase
      .from("event_entrants")
      .select("id")
      .eq("event_id", eventId)
      .in("entrant_id", Array.from(entrantIds));
    for (const e of entries ?? []) myEntryIds.add(e.id);
  }

  return rows.filter(
    (r) =>
      (r.event_entrant_id && myEntryIds.has(r.event_entrant_id)) ||
      (r.entrant_id && entrantIds.has(r.entrant_id)) ||
      (email && (r.email ?? "").toLowerCase() === email),
  );
}

export function nightDateLabel(date: string | null) {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

export function isTonight(date: string | null) {
  if (!date) return false;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  return date.slice(0, 10) === today;
}
