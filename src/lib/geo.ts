// Client-safe helpers for KML → GeoJSON parsing and distance/elevation math.
import { kml as kmlToGeoJson } from "@tmcw/togeojson";

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

/** Parses a KML string in the browser. Returns lines + placemarks. */
export function parseKml(kmlText: string): ParsedRouteLayer {
  const doc = new DOMParser().parseFromString(kmlText, "application/xml");
  const gj = kmlToGeoJson(doc);

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
