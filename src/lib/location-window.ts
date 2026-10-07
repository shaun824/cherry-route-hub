// Team location sharing is only allowed from 3 days before race day until the
// day after the last event day. Shared by the map (button) and server (write gate).
export const LOCATION_WINDOW_DAYS = 3;

export function raceLocationWindow(eventDate?: string | null, days?: { date?: string | null }[] | null) {
  const dates = [eventDate, ...(days ?? []).map((d) => d.date)]
    .filter((d): d is string => !!d)
    .map((d) => new Date(d.slice(0, 10) + "T00:00:00Z").getTime())
    .filter((t) => !Number.isNaN(t));
  if (!dates.length) return null;
  const first = Math.min(...dates);
  const last = Math.max(...dates);
  return { opens: first - LOCATION_WINDOW_DAYS * 86_400_000, closes: last + 2 * 86_400_000 };
}

export function inRaceLocationWindow(eventDate?: string | null, days?: { date?: string | null }[] | null, now = Date.now()) {
  const w = raceLocationWindow(eventDate, days);
  return !!w && now >= w.opens && now < w.closes;
}
