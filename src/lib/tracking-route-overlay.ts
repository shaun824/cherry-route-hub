// Works out which of an event's KML routes the tracked riders are actually on,
// so the live tracking map can overlay the right course.
//
// Matching order:
//  1. Only consider routes on the event day that matches today (if there is one).
//  2. Prefer a route whose tier/name matches the rider's entry category
//     (e.g. category "Silver" -> the Silver route).
//  3. Otherwise pick the route whose line is closest to the rider positions.
import { haversineMeters, type LatLngAlt } from "@/lib/geo";
import type { Event, EventRoute } from "@/lib/mock-data";

export type RouteCandidate = {
  route: EventRoute;
  dayId: string;
  dayLabel: string;
  color: string;
  lines: LatLngAlt[][];
};

export type RiderPoint = { lat: number; lng: number; category?: string | null };

/** Routes on the day that matches "today", falling back to every day. */
export function candidateDayIds(event: Event | undefined, now = new Date()): string[] | null {
  const days = event?.days ?? [];
  if (days.length === 0) return null;
  const today = now.toISOString().slice(0, 10);
  const match = days.filter((d) => (d.date ?? "").slice(0, 10) === today);
  return match.length ? match.map((d) => d.id) : null;
}

function norm(s: string | null | undefined) {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** True when a rider's entry category clearly refers to this route. */
export function categoryMatchesRoute(category: string | null | undefined, route: EventRoute) {
  const c = norm(category);
  if (!c) return false;
  const words = c.split(" ").filter((w) => w.length > 2);
  const hay = `${norm(route.tier)} ${norm(route.name)}`;
  return words.some((w) => hay.includes(w));
}

/** Shortest distance (metres) from a point to any vertex of the route lines. */
export function distanceToRouteM(lines: LatLngAlt[][], lat: number, lng: number): number {
  let best = Number.POSITIVE_INFINITY;
  const p: LatLngAlt = [lng, lat];
  for (const line of lines) {
    // Vertex sampling is enough here — routes are already simplified.
    const step = Math.max(1, Math.floor(line.length / 400));
    for (let i = 0; i < line.length; i += step) {
      const d = haversineMeters(p, line[i]);
      if (d < best) best = d;
    }
  }
  return best;
}

/**
 * Pick the routes to overlay. Returns the matched route ids; empty means
 * "no confident match" and the caller should show all candidates faintly.
 */
export function matchRoutesForRiders(
  candidates: RouteCandidate[],
  riders: RiderPoint[],
): string[] {
  if (candidates.length === 0) return [];
  if (candidates.length === 1) return [candidates[0].route.id];

  const byCategory = new Set<string>();
  for (const r of riders) {
    for (const c of candidates) {
      if (categoryMatchesRoute(r.category, c.route)) byCategory.add(c.route.id);
    }
  }
  if (byCategory.size > 0) return [...byCategory];

  if (riders.length === 0) return [];

  // Closest-line fallback: score each route by the median rider distance.
  let bestId: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const c of candidates) {
    if (c.lines.length === 0) continue;
    const dists = riders
      .map((r) => distanceToRouteM(c.lines, r.lat, r.lng))
      .sort((a, b) => a - b);
    const median = dists[Math.floor(dists.length / 2)] ?? Number.POSITIVE_INFINITY;
    if (median < bestScore) {
      bestScore = median;
      bestId = c.route.id;
    }
  }
  // Riders more than 5 km from every route are probably not on course yet.
  return bestId && bestScore < 5000 ? [bestId] : [];
}
