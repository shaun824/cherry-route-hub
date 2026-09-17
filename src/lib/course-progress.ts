// Projects a rider's GPS position onto the course line so the live map can say
// "18.4 km of 42 km · ~44%" instead of just showing a dot.
import { haversineMeters, type LatLngAlt } from "@/lib/geo";

export type CourseLine = {
  /** Cumulative metres at each vertex. */
  cum: number[];
  points: LatLngAlt[];
  totalM: number;
};

/** Flattens a route's lines into one measured polyline (longest line wins). */
export function buildCourseLine(lines: LatLngAlt[][]): CourseLine | null {
  let best: LatLngAlt[] | null = null;
  let bestLen = 0;
  for (const line of lines) {
    if (line.length < 2) continue;
    let len = 0;
    for (let i = 1; i < line.length; i += 1) len += haversineMeters(line[i - 1], line[i]);
    if (len > bestLen) {
      bestLen = len;
      best = line;
    }
  }
  if (!best) return null;
  const cum = [0];
  for (let i = 1; i < best.length; i += 1) {
    cum.push(cum[i - 1] + haversineMeters(best[i - 1], best[i]));
  }
  return { cum, points: best, totalM: cum[cum.length - 1] };
}

export type ProgressResult = {
  /** Metres travelled along the course. */
  alongM: number;
  totalM: number;
  pct: number;
  /** Metres from the rider to the nearest point on the line. */
  offCourseM: number;
};

/** Nearest vertex projection — routes are already simplified, so this is plenty. */
export function progressOnCourse(
  course: CourseLine,
  lat: number,
  lng: number,
): ProgressResult | null {
  if (course.points.length < 2) return null;
  const p: LatLngAlt = [lng, lat];
  let bestIdx = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < course.points.length; i += 1) {
    const d = haversineMeters(p, course.points[i]);
    if (d < bestD) {
      bestD = d;
      bestIdx = i;
    }
  }
  const alongM = course.cum[bestIdx];
  return {
    alongM,
    totalM: course.totalM,
    pct: course.totalM > 0 ? (alongM / course.totalM) * 100 : 0,
    offCourseM: bestD,
  };
}

export function formatProgress(p: ProgressResult): string {
  return `${(p.alongM / 1000).toFixed(1)} km of ${(p.totalM / 1000).toFixed(0)} km · ~${Math.round(p.pct)}%`;
}
