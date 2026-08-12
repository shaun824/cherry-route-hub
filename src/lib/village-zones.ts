// Drawn areas ("zones") on the village map: outlines with real-world size in
// metres, used for planning how much ground each element takes up.

export type ZonePoint = { lat: number; lng: number };

export type VillageZone = {
  id: string;
  name: string;
  /** hex fill/stroke colour */
  color?: string;
  /** outline vertices, in order */
  points: ZonePoint[];
  notes?: string;
};

const M_PER_DEG_LAT = 111320;

export const ZONE_COLORS = [
  "#e11d48", "#f97316", "#ca8a04", "#16a34a", "#0d9488",
  "#0ea5e9", "#2563eb", "#a855f7", "#475569",
];

export function zoneColor(z: VillageZone): string {
  return z.color || "#0ea5e9";
}

function mPerDegLng(lat: number) {
  return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

/** Local east/north metres relative to a reference point (flat-earth, fine at village scale). */
export function toMetres(ref: ZonePoint, p: ZonePoint): { e: number; n: number } {
  return { e: (p.lng - ref.lng) * mPerDegLng(ref.lat), n: (p.lat - ref.lat) * M_PER_DEG_LAT };
}

export function fromMetres(ref: ZonePoint, e: number, n: number): ZonePoint {
  return {
    lat: +(ref.lat + n / M_PER_DEG_LAT).toFixed(7),
    lng: +(ref.lng + e / mPerDegLng(ref.lat)).toFixed(7),
  };
}

export function distanceM(a: ZonePoint, b: ZonePoint): number {
  const { e, n } = toMetres(a, b);
  return Math.hypot(e, n);
}

export function zoneCentroid(z: VillageZone): ZonePoint | null {
  if (z.points.length === 0) return null;
  const lat = z.points.reduce((s, p) => s + p.lat, 0) / z.points.length;
  const lng = z.points.reduce((s, p) => s + p.lng, 0) / z.points.length;
  return { lat, lng };
}

/** Area in square metres (shoelace on local metre coords). */
export function zoneAreaM2(z: VillageZone): number {
  if (z.points.length < 3) return 0;
  const ref = z.points[0];
  const pts = z.points.map((p) => toMetres(ref, p));
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.e * b.n - b.e * a.n;
  }
  return Math.abs(sum) / 2;
}

export function zonePerimeterM(z: VillageZone): number {
  if (z.points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < z.points.length; i++) {
    sum += distanceM(z.points[i], z.points[(i + 1) % z.points.length]);
  }
  return sum;
}

/** Bounding box size in metres (width east-west × height north-south). */
export function zoneSizeM(z: VillageZone): { w: number; h: number } {
  if (z.points.length === 0) return { w: 0, h: 0 };
  const ref = z.points[0];
  const pts = z.points.map((p) => toMetres(ref, p));
  const es = pts.map((p) => p.e);
  const ns = pts.map((p) => p.n);
  return { w: Math.max(...es) - Math.min(...es), h: Math.max(...ns) - Math.min(...ns) };
}

export function formatArea(m2: number): string {
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} ha (${Math.round(m2).toLocaleString()} m²)`;
  return `${Math.round(m2).toLocaleString()} m²`;
}

export function formatLength(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m < 10 ? m.toFixed(1) : Math.round(m)} m`;
}

/** Rectangle of the given size in metres, centred on a point. */
export function rectangleZone(centre: ZonePoint, widthM: number, heightM: number, name: string): VillageZone {
  const w = widthM / 2;
  const h = heightM / 2;
  return {
    id: crypto.randomUUID(),
    name,
    color: ZONE_COLORS[0],
    points: [
      fromMetres(centre, -w, h),
      fromMetres(centre, w, h),
      fromMetres(centre, w, -h),
      fromMetres(centre, -w, -h),
    ],
  };
}

/** Rescales a zone about its centroid so its bounding box matches the given metres. */
export function resizeZone(z: VillageZone, widthM: number, heightM: number): VillageZone {
  const c = zoneCentroid(z);
  const size = zoneSizeM(z);
  if (!c || size.w <= 0 || size.h <= 0) return z;
  const sx = widthM / size.w;
  const sy = heightM / size.h;
  return {
    ...z,
    points: z.points.map((p) => {
      const { e, n } = toMetres(c, p);
      return fromMetres(c, e * sx, n * sy);
    }),
  };
}

/** Moves the whole zone so its centroid lands on `to`. */
export function moveZone(z: VillageZone, to: ZonePoint): VillageZone {
  const c = zoneCentroid(z);
  if (!c) return z;
  const dLat = to.lat - c.lat;
  const dLng = to.lng - c.lng;
  return { ...z, points: z.points.map((p) => ({ lat: +(p.lat + dLat).toFixed(7), lng: +(p.lng + dLng).toFixed(7) })) };
}

// ---- overlap detection ----

function pointInPolygon(pt: { e: number; n: number }, poly: { e: number; n: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.n > pt.n !== b.n > pt.n && pt.e < ((b.e - a.e) * (pt.n - a.n)) / (b.n - a.n) + a.e) inside = !inside;
  }
  return inside;
}

function segmentsCross(
  p1: { e: number; n: number }, p2: { e: number; n: number },
  p3: { e: number; n: number }, p4: { e: number; n: number },
): boolean {
  const d = (a: typeof p1, b: typeof p1, c: typeof p1) => (b.e - a.e) * (c.n - a.n) - (b.n - a.n) * (c.e - a.e);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/** True when two zones overlap (edges cross or one sits inside the other). */
export function zonesOverlap(a: VillageZone, b: VillageZone): boolean {
  if (a.points.length < 3 || b.points.length < 3) return false;
  const ref = a.points[0];
  const A = a.points.map((p) => toMetres(ref, p));
  const B = b.points.map((p) => toMetres(ref, p));
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < B.length; j++) {
      if (segmentsCross(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) return true;
    }
  }
  return pointInPolygon(A[0], B) || pointInPolygon(B[0], A);
}

/** Ids of zones that clash with at least one other zone. */
export function overlappingZoneIds(zones: VillageZone[]): Set<string> {
  const hit = new Set<string>();
  for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      if (zonesOverlap(zones[i], zones[j])) {
        hit.add(zones[i].id);
        hit.add(zones[j].id);
      }
    }
  }
  return hit;
}
