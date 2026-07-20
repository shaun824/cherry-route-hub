// Client-safe helpers for KML/GPX → GeoJSON parsing and distance/elevation math.
import { kml as kmlToGeoJson, gpx as gpxToGeoJson } from "@tmcw/togeojson";

export type LatLngAlt = [number, number, number?]; // [lng, lat, alt?]

export type ParsedRouteLayer = {
  name: string | null;
  description: string | null;
  lines: LatLngAlt[][];   // one or more polylines
  points: {
    name: string | null;
    description: string | null;
    coord: LatLngAlt;
  }[];
};

/** Parses a KML or GPX string in the browser. Returns lines + placemarks. */
export function parseKml(kmlText: string): ParsedRouteLayer {
  const doc = new DOMParser().parseFromString(kmlText, "application/xml");
  const root = doc.documentElement?.nodeName?.toLowerCase() ?? "";
  const gj = root === "gpx" ? gpxToGeoJson(doc) : kmlToGeoJson(doc);

  const lines: LatLngAlt[][] = [];
  const points: ParsedRouteLayer["points"] = [];
  let topName: string | null = null;
  let topDesc: string | null = null;

  const collect = (feat: any) => {
    if (!feat || !feat.geometry) return;
    const props = feat.properties ?? {};
    const name = (props.name as string | undefined) ?? null;
    const description =
      (props.description as string | undefined) ??
      (props.styleUrl as string | undefined) ??
      null;
    const g = feat.geometry;
    if (g.type === "LineString") {
      lines.push(g.coordinates as LatLngAlt[]);
    } else if (g.type === "MultiLineString") {
      for (const line of g.coordinates) lines.push(line as LatLngAlt[]);
    } else if (g.type === "Point") {
      points.push({ name, description, coord: g.coordinates as LatLngAlt });
    } else if (g.type === "GeometryCollection" && Array.isArray(g.geometries)) {
      for (const sub of g.geometries) collect({ properties: props, geometry: sub });
    }
    if (!topName && name) topName = name;
    if (!topDesc && description) topDesc = description;
  };

  if (gj.type === "FeatureCollection") for (const f of gj.features) collect(f);
  else collect(gj);

  return { name: topName, description: topDesc, lines, points };
}

/**
 * Ramer–Douglas–Peucker polyline simplification.
 * `tolerance` in metres — points closer than this to the segment are dropped.
 * Preserves altitude on the retained points.
 */
export function simplifyPolyline(coords: LatLngAlt[], toleranceMeters = 6): LatLngAlt[] {
  if (coords.length <= 2) return coords;

  // Convert lat/lng to local metric plane for accurate perpendicular distance.
  const lat0 = coords[0][1];
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const proj = (c: LatLngAlt): [number, number] => [c[0] * mPerDegLng, c[1] * mPerDegLat];

  const keep = new Uint8Array(coords.length);
  keep[0] = 1;
  keep[coords.length - 1] = 1;

  const stack: [number, number][] = [[0, coords.length - 1]];
  const tol2 = toleranceMeters * toleranceMeters;

  while (stack.length) {
    const [i, j] = stack.pop()!;
    if (j - i < 2) continue;
    const [ax, ay] = proj(coords[i]);
    const [bx, by] = proj(coords[j]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    let maxD2 = 0;
    let maxIdx = -1;
    for (let k = i + 1; k < j; k++) {
      const [px, py] = proj(coords[k]);
      const t = ((px - ax) * dx + (py - ay) * dy) / len2;
      const tc = Math.max(0, Math.min(1, t));
      const cx = ax + tc * dx;
      const cy = ay + tc * dy;
      const d2 = (px - cx) * (px - cx) + (py - cy) * (py - cy);
      if (d2 > maxD2) {
        maxD2 = d2;
        maxIdx = k;
      }
    }
    if (maxD2 > tol2 && maxIdx !== -1) {
      keep[maxIdx] = 1;
      stack.push([i, maxIdx], [maxIdx, j]);
    }
  }

  const out: LatLngAlt[] = [];
  for (let i = 0; i < coords.length; i++) if (keep[i]) out.push(coords[i]);
  return out;
}

/** Hard cap: uniform stride down-sample as a fallback when RDP still leaves too many points. */
export function capPolyline(coords: LatLngAlt[], max: number): LatLngAlt[] {
  if (coords.length <= max) return coords;
  const step = coords.length / max;
  const out: LatLngAlt[] = [];
  for (let i = 0; i < max; i++) out.push(coords[Math.floor(i * step)]);
  out.push(coords[coords.length - 1]);
  return out;
}


/** Haversine distance in metres between two [lng, lat] points. */
export function haversineMeters(a: LatLngAlt, b: LatLngAlt): number {
  const R = 6_371_000;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Total polyline length in kilometres. */
export function polylineKm(coords: LatLngAlt[]): number {
  let m = 0;
  for (let i = 1; i < coords.length; i++) m += haversineMeters(coords[i - 1], coords[i]);
  return m / 1000;
}

/**
 * Total climb in metres, computed from altitude values in the coords. Applies a
 * small threshold (1.5m) to filter GPS noise. Returns null if no altitude data.
 */
export function polylineElevationGainM(coords: LatLngAlt[]): number | null {
  const hasAlt = coords.some((c) => typeof c[2] === "number" && Number.isFinite(c[2]));
  if (!hasAlt) return null;
  let gain = 0;
  let last: number | null = null;
  for (const c of coords) {
    const alt = c[2];
    if (typeof alt !== "number" || !Number.isFinite(alt)) continue;
    if (last !== null) {
      const d = alt - last;
      if (d > 1.5) gain += d;
    }
    last = alt;
  }
  return Math.round(gain);
}

/** Bounds as [[south, west], [north, east]] for Leaflet fitBounds. */
export function boundsFromCoords(coords: LatLngAlt[]): [[number, number], [number, number]] | null {
  if (!coords.length) return null;
  let s = 90, w = 180, n = -90, e = -180;
  for (const [lng, lat] of coords) {
    if (lat < s) s = lat;
    if (lat > n) n = lat;
    if (lng < w) w = lng;
    if (lng > e) e = lng;
  }
  return [[s, w], [n, e]];
}

/** Even-index sample of a polyline down to at most `max` points. */
export function samplePolyline(coords: LatLngAlt[], max = 200): LatLngAlt[] {
  if (coords.length <= max) return coords;
  const step = coords.length / max;
  const out: LatLngAlt[] = [];
  for (let i = 0; i < max; i++) out.push(coords[Math.floor(i * step)]);
  out.push(coords[coords.length - 1]);
  return out;
}
