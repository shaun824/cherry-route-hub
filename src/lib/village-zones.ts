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
  /** crew-only: what kind of structure/area this outline is */
  kind?: ZoneKind;
  /** crew-only: what the area contains (kit list / spec) */
  spec?: string;
  /** crew-only: build and strike instructions */
  crewNotes?: string;
  /**
   * Who sees this outline on the map. Areas drawn before this setting existed
   * (no value) stay visible to riders, as they always were; "crew" hides the
   * outline from riders, "rider" draws the clean outline (no name or build
   * detail) on the rider map.
   */
  audience?: "crew" | "rider";
};

/** True when this outline should also be drawn on the rider-facing map. */
export function riderSeesZone(z: VillageZone): boolean {
  return (z.audience ?? "rider") === "rider";
}

/** Crew-only classification of a drawn area. */
export type ZoneKind =
  | "bedouin"
  | "marquee"
  | "gazebo"
  | "speed_fence"
  | "candy_tape"
  | "barrier"
  | "parking"
  | "camping"
  | "branding"
  | "plant"
  | "other";

export const ZONE_KINDS: { id: ZoneKind; label: string; color: string }[] = [
  { id: "bedouin", label: "Bedouin tent", color: "#a855f7" },
  { id: "marquee", label: "Marquee", color: "#2563eb" },
  { id: "gazebo", label: "Gazebo row", color: "#0ea5e9" },
  { id: "speed_fence", label: "Speed fencing", color: "#f97316" },
  { id: "candy_tape", label: "Candy tape / cordon", color: "#ca8a04" },
  { id: "barrier", label: "Barrier line", color: "#e11d48" },
  { id: "parking", label: "Parking block", color: "#475569" },
  { id: "camping", label: "Camping block", color: "#16a34a" },
  { id: "branding", label: "Signage / branding area", color: "#0d9488" },
  { id: "plant", label: "Vehicle / plant", color: "#7c3aed" },
  { id: "other", label: "Other", color: "#0ea5e9" },
];

export function zoneKindLabel(kind?: ZoneKind): string {
  return ZONE_KINDS.find((k) => k.id === kind)?.label ?? "Untyped area";
}

/** True when the area carries crew build detail worth showing. */
export function hasBuildDetail(z: VillageZone): boolean {
  return !!(z.kind || z.spec?.trim() || z.crewNotes?.trim() || z.notes?.trim());
}


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
  // Drawn rings often repeat the first point as the closing point; counting it
  // twice drags the "centre" out towards that corner.
  const pts = z.points.slice();
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (pts.length > 2 && first && last && first.lat === last.lat && first.lng === last.lng) pts.pop();
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
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

/**
 * True size of the shape measured along its own sides, not north/south and
 * east/west. A 6m × 40m start chute lying at an angle has a north-south /
 * east-west box of roughly 25m × 38m — the box is not the chute. This finds the
 * tightest rectangle that wraps the outline (rotating callipers, brute-forced
 * over each edge direction) and returns the real across × along measurements
 * plus the bearing the shape is lying at (degrees clockwise from north).
 */
export function zoneTrueSizeM(z: VillageZone): { across: number; along: number; bearingDeg: number } {
  const pts = ringPoints(z);
  if (pts.length < 3) {
    const s = zoneSizeM(z);
    return { across: Math.min(s.w, s.h), along: Math.max(s.w, s.h), bearingDeg: 0 };
  }
  const ref = pts[0];
  const M = pts.map((p) => toMetres(ref, p));
  let best: { across: number; along: number; angle: number } | null = null;
  for (let i = 0; i < M.length; i++) {
    const a = M[i];
    const b = M[(i + 1) % M.length];
    const len = Math.hypot(b.e - a.e, b.n - a.n);
    if (len < 1e-6) continue;
    const ux = (b.e - a.e) / len;
    const uy = (b.n - a.n) / len;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of M) {
      const u = p.e * ux + p.n * uy;
      const v = -p.e * uy + p.n * ux;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const w = maxU - minU;
    const h = maxV - minV;
    if (!best || w * h < best.across * best.along) {
      const along = Math.max(w, h);
      const across = Math.min(w, h);
      // angle of the long side, measured clockwise from north
      const longIsU = w >= h;
      const dirE = longIsU ? ux : -uy;
      const dirN = longIsU ? uy : ux;
      best = { across, along, angle: (Math.atan2(dirE, dirN) * 180) / Math.PI };
    }
  }
  if (!best) {
    const s = zoneSizeM(z);
    return { across: Math.min(s.w, s.h), along: Math.max(s.w, s.h), bearingDeg: 0 };
  }
  const bearing = ((best.angle % 180) + 180) % 180;
  return { across: best.across, along: best.along, bearingDeg: bearing };
}

/** Outline points with a duplicated closing point dropped. */
function ringPoints(z: VillageZone): ZonePoint[] {
  const pts = z.points.slice();
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (pts.length > 2 && first && last && first.lat === last.lat && first.lng === last.lng) pts.pop();
  return pts;
}

/** Length of every side, in drawing order — for checking a shape side by side. */
export function zoneEdgeLengthsM(z: VillageZone): number[] {
  const pts = ringPoints(z);
  if (pts.length < 2) return [];
  return pts.map((p, i) => distanceM(p, pts[(i + 1) % pts.length]));
}

/**
 * Rescales a shape along its own sides so its true across × along measurements
 * match, keeping the angle it is lying at. Use this rather than resizeZone
 * whenever a real-world width matters.
 */
export function resizeZoneTrue(z: VillageZone, acrossM: number, alongM: number): VillageZone {
  const c = zoneCentroid(z);
  const cur = zoneTrueSizeM(z);
  if (!c || cur.across <= 0 || cur.along <= 0) return z;
  const rad = (cur.bearingDeg * Math.PI) / 180; // clockwise from north
  // unit vector along the long axis, in east/north metres
  const ae = Math.sin(rad);
  const an = Math.cos(rad);
  const sAlong = alongM / cur.along;
  const sAcross = acrossM / cur.across;
  return {
    ...z,
    points: z.points.map((p) => {
      const { e, n } = toMetres(c, p);
      const along = e * ae + n * an;
      const across = -e * an + n * ae;
      const a2 = along * sAlong;
      const c2 = across * sAcross;
      return fromMetres(c, a2 * ae - c2 * an, a2 * an + c2 * ae);
    }),
  };
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

// ---- duplication helpers (build uniform, repeatable layouts) ----

/** Shifts a zone by an east/north offset in metres, keeping its exact shape and size. */
export function translateZone(z: VillageZone, eastM: number, northM: number): VillageZone {
  const ref = z.points[0];
  if (!ref) return z;
  return {
    ...z,
    points: z.points.map((p) => {
      const { e, n } = toMetres(ref, p);
      return fromMetres(ref, e + eastM, n + northM);
    }),
  };
}

/** Rotates a zone about its centroid (degrees, clockwise). */
export function rotateZone(z: VillageZone, degrees: number): VillageZone {
  const c = zoneCentroid(z);
  if (!c) return z;
  const rad = (-degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    ...z,
    points: z.points.map((p) => {
      const { e, n } = toMetres(c, p);
      return fromMetres(c, e * cos - n * sin, e * sin + n * cos);
    }),
  };
}

/** Suggests the next name in a series: "Tent 4" -> "Tent 5", "Gazebo" -> "Gazebo 2". */
export function nextZoneName(name: string, taken: string[]): string {
  const m = name.match(/^(.*?)(\d+)\s*$/);
  const base = m ? m[1] : `${name} `;
  let n = m ? Number(m[2]) + 1 : 2;
  const used = new Set(taken.map((t) => t.trim().toLowerCase()));
  let candidate = `${base}${n}`.trim();
  while (used.has(candidate.toLowerCase())) {
    n += 1;
    candidate = `${base}${n}`.trim();
  }
  return candidate;
}

export type DuplicateDirection = "east" | "west" | "north" | "south";

/**
 * Copies a zone `count` times in a straight line, keeping identical size and a
 * fixed gap (metres) between footprints — the way a row of tents is pegged out.
 */
export function duplicateZoneLine(
  z: VillageZone,
  count: number,
  gapM: number,
  direction: DuplicateDirection,
  taken: string[],
): VillageZone[] {
  const size = zoneSizeM(z);
  const stepE = direction === "east" ? size.w + gapM : direction === "west" ? -(size.w + gapM) : 0;
  const stepN = direction === "north" ? size.h + gapM : direction === "south" ? -(size.h + gapM) : 0;
  const names = [...taken];
  const out: VillageZone[] = [];
  let lastName = z.name;
  for (let i = 1; i <= count; i++) {
    const name = nextZoneName(lastName, names);
    names.push(name);
    lastName = name;
    out.push({ ...translateZone(z, stepE * i, stepN * i), id: crypto.randomUUID(), name });
  }
  return out;
}

/** Grid of identical copies: `cols` across (east) × `rows` down (south), excluding the original. */
export function duplicateZoneGrid(
  z: VillageZone,
  cols: number,
  rows: number,
  gapM: number,
  taken: string[],
): VillageZone[] {
  const size = zoneSizeM(z);
  const dx = size.w + gapM;
  const dy = size.h + gapM;
  const names = [...taken];
  const out: VillageZone[] = [];
  let lastName = z.name;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 && c === 0) continue;
      const name = nextZoneName(lastName, names);
      names.push(name);
      lastName = name;
      out.push({ ...translateZone(z, dx * c, -dy * r), id: crypto.randomUUID(), name });
    }
  }
  return out;
}

/** Ray-casting test: is this lat/lng inside a drawn area? */
export function pointInZone(p: { lat: number; lng: number }, zone: VillageZone): boolean {
  const pts = zone.points ?? [];
  if (pts.length < 3) return false;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].lng;
    const yi = pts[i].lat;
    const xj = pts[j].lng;
    const yj = pts[j].lat;
    const intersect =
      yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
