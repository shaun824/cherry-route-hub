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

/** Point on the course `alongM` metres from the start (clamped to the line). */
export function pointAtAlong(course: CourseLine, alongM: number): { lat: number; lng: number } {
  const d = Math.max(0, Math.min(alongM, course.totalM));
  const { cum, points } = course;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i += 1;
  const seg = cum[i] - cum[i - 1];
  const f = seg > 0 ? (d - cum[i - 1]) / seg : 0;
  const a = points[i - 1];
  const b = points[i];
  return { lng: a[0] + (b[0] - a[0]) * f, lat: a[1] + (b[1] - a[1]) * f };
}

// ---- Dead-reckoning estimates for riders whose phone has gone quiet ----
export const ESTIMATE_AFTER_MS = 60_000;
export const ESTIMATE_MAX_MS = 45 * 60_000;
const DEFAULT_KPH = 12;
const MIN_HISTORY_MS = 3 * 60_000;

export type RiderEstimate = {
  lat: number;
  lng: number;
  kph: number;
  /** metres beyond the last real fix along the route */
  aheadM: number;
  /** true once 45+ min without signal — dot is frozen */
  capped: boolean;
  /** false when there's no route, so the dot stays at the last fix */
  moved: boolean;
};

/** Display-only estimate; never stored. Returns null while the fix is fresh. */
export function estimateRider(
  course: CourseLine | null,
  last: { lat: number; lng: number; recordedAt: string },
  first: { lat: number; lng: number; recordedAt: string } | null,
  now = Date.now(),
): RiderEstimate | null {
  const lastT = new Date(last.recordedAt).getTime();
  const age = now - lastT;
  if (age < ESTIMATE_AFTER_MS) return null;
  const capped = age >= ESTIMATE_MAX_MS;
  if (!course) return { lat: last.lat, lng: last.lng, kph: DEFAULT_KPH, aheadM: 0, capped, moved: false };
  const lp = progressOnCourse(course, last.lat, last.lng);
  if (!lp || lp.offCourseM > 1000) return { lat: last.lat, lng: last.lng, kph: DEFAULT_KPH, aheadM: 0, capped, moved: false };
  let kph = DEFAULT_KPH;
  if (first) {
    const dt = lastT - new Date(first.recordedAt).getTime();
    const fp = progressOnCourse(course, first.lat, first.lng);
    if (dt >= MIN_HISTORY_MS && fp) {
      const v = ((lp.alongM - fp.alongM) / (dt / 1000)) * 3.6;
      if (v > 1 && v < 60) kph = v;
    }
  }
  const elapsedS = Math.min(age, ESTIMATE_MAX_MS) / 1000;
  const along = Math.min(lp.alongM + (kph / 3.6) * elapsedS, course.totalM);
  const pt = pointAtAlong(course, along);
  return { ...pt, kph, aheadM: along - lp.alongM, capped, moved: true };
}

/** Longest a dot glides ahead of its last fix before the next 10-second fix lands. */
export const GLIDE_MAX_MS = 20_000;

/**
 * Display-only glide between fresh fixes (under a minute old): moves the dot along
 * the route at the rider's recent speed so it doesn't jump every 10 seconds. The
 * next real fix corrects it. Never stored, never used for SOS.
 */
export function glideRider(
  course: CourseLine | null,
  last: { lat: number; lng: number; recordedAt: string },
  first: { lat: number; lng: number; recordedAt: string } | null,
  now = Date.now(),
): { lat: number; lng: number } | null {
  if (!course || !first) return null;
  const lastT = new Date(last.recordedAt).getTime();
  const age = now - lastT;
  if (age <= 0 || age >= ESTIMATE_AFTER_MS) return null;
  const lp = progressOnCourse(course, last.lat, last.lng);
  const fp = progressOnCourse(course, first.lat, first.lng);
  if (!lp || !fp || lp.offCourseM > 150) return null;
  const dt = lastT - new Date(first.recordedAt).getTime();
  if (dt < MIN_HISTORY_MS) return null;
  const kph = ((lp.alongM - fp.alongM) / (dt / 1000)) * 3.6;
  if (!(kph > 3 && kph < 80)) return null;
  const along = Math.min(lp.alongM + (kph / 3.6) * (Math.min(age, GLIDE_MAX_MS) / 1000), course.totalM);
  return pointAtAlong(course, along);
}
