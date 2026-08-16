// Offline mode: pre-download map tiles + a data snapshot for a venue with no signal.
//
// Two halves work together:
//  1. Tiles + route files are stored in the browser Cache API and served back by
//     the service worker (public/push-sw.js) when the network is gone.
//  2. Village/tent/route data is snapshotted into localStorage, and the normal
//     fetchers fall back to it when Supabase is unreachable.

export const TILE_CACHE = "rce-tiles-v1";
const SNAP_PREFIX = "rce:offline:snap:";
const META_PREFIX = "rce:offline:meta:";

export type OfflineMeta = {
  eventId: string;
  downloadedAt: string;
  tiles: number;
  bytes: number;
};

export type LatLng = { lat: number; lng: number };
export type Bounds = { north: number; south: number; east: number; west: number };

/* ------------------------------------------------------------------ tiles */

const SAT_URL = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const OSM_URL = (z: number, x: number, y: number) =>
  `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`;

function lngToX(lng: number, z: number) {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}
function latToY(lat: number, z: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
}

export function boundsFromPoints(points: LatLng[], padDeg = 0.004): Bounds | null {
  const valid = points.filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng));
  if (!valid.length) return null;
  const lats = valid.map((p) => p.lat);
  const lngs = valid.map((p) => p.lng);
  return {
    north: Math.max(...lats) + padDeg,
    south: Math.min(...lats) - padDeg,
    east: Math.max(...lngs) + padDeg,
    west: Math.min(...lngs) - padDeg,
  };
}

/** Tile URLs covering the bounds. Village = tight + deep zoom, route = wide + shallow. */
export function tileUrlsForBounds(b: Bounds, minZoom: number, maxZoom: number, limit = 5000): string[] {
  const urls: string[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const x0 = lngToX(b.west, z);
    const x1 = lngToX(b.east, z);
    const y0 = latToY(b.north, z);
    const y1 = latToY(b.south, z);
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        urls.push(SAT_URL(z, x, y));
        if (z <= 17) urls.push(OSM_URL(z, x, y));
        if (urls.length >= limit) return urls;
      }
    }
  }
  return urls;
}

export function estimateTileCount(b: Bounds, minZoom: number, maxZoom: number) {
  return tileUrlsForBounds(b, minZoom, maxZoom).length;
}

type Progress = { done: number; total: number; bytes: number };

async function cacheUrls(
  cacheName: string,
  urls: string[],
  onProgress: (p: Progress) => void,
  signal?: AbortSignal,
  startBytes = 0,
): Promise<{ done: number; bytes: number }> {
  const cache = await caches.open(cacheName);
  let done = 0;
  let bytes = startBytes;
  const queue = [...urls];
  const total = urls.length;

  async function worker() {
    while (queue.length) {
      if (signal?.aborted) return;
      const url = queue.shift()!;
      try {
        const existing = await cache.match(url, { ignoreVary: true });
        if (!existing) {
          const res = await fetch(url, { mode: "cors", credentials: "omit" });
          if (res.ok) {
            const buf = await res.clone().arrayBuffer();
            bytes += buf.byteLength;
            await cache.put(url, res);
          }
        }
      } catch {
        /* a missing tile must never fail the whole pack */
      }
      done += 1;
      if (done % 5 === 0 || done === total) onProgress({ done, total, bytes });
    }
  }

  await Promise.all(Array.from({ length: 6 }, worker));
  onProgress({ done, total, bytes });
  return { done, bytes };
}

/* -------------------------------------------------------------- snapshots */

export function saveSnapshot(key: string, data: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SNAP_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* quota — offline data is best effort */
  }
}

export function readSnapshot<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SNAP_PREFIX + key);
    if (!raw) return null;
    return (JSON.parse(raw) as { data: T }).data ?? null;
  } catch {
    return null;
  }
}

/** Run a fetcher, snapshot its result, and fall back to the snapshot when offline. */
export async function withSnapshot<T>(key: string, fn: () => Promise<T>, isEmpty?: (v: T) => boolean): Promise<T> {
  try {
    const value = await fn();
    if (!isEmpty || !isEmpty(value)) saveSnapshot(key, value);
    else {
      const cached = readSnapshot<T>(key);
      if (cached) return cached;
    }
    return value;
  } catch (err) {
    const cached = readSnapshot<T>(key);
    if (cached) return cached;
    throw err;
  }
}

/* ------------------------------------------------------------------- meta */

export function readOfflineMeta(eventId: string): OfflineMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(META_PREFIX + eventId);
    return raw ? (JSON.parse(raw) as OfflineMeta) : null;
  } catch {
    return null;
  }
}

function writeOfflineMeta(meta: OfflineMeta) {
  try {
    localStorage.setItem(META_PREFIX + meta.eventId, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
}

export async function clearOfflinePack(eventId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(META_PREFIX + eventId);
  try {
    await caches.delete(TILE_CACHE);
  } catch {
    /* ignore */
  }
}

/* --------------------------------------------------------------- download */

export type PackInput = {
  eventId: string;
  /** tight venue box — gets deep zoom (satellite up to z18) */
  village?: Bounds | null;
  /** wide route box — gets shallower zoom so the pack stays small */
  route?: Bounds | null;
  /** KML/GPX and image URLs to keep available offline */
  files?: string[];
  /** arbitrary data snapshots, keyed */
  snapshots?: Record<string, unknown>;
};

export async function downloadOfflinePack(
  input: PackInput,
  onProgress: (p: Progress) => void,
  signal?: AbortSignal,
): Promise<OfflineMeta> {
  const urls: string[] = [];
  if (input.village) urls.push(...tileUrlsForBounds(input.village, 13, 18, 4000));
  if (input.route) urls.push(...tileUrlsForBounds(input.route, 10, 14, 1500));
  const unique = Array.from(new Set(urls));
  const files = Array.from(new Set(input.files ?? []));

  for (const [key, value] of Object.entries(input.snapshots ?? {})) saveSnapshot(key, value);

  const tiles = await cacheUrls(TILE_CACHE, unique, (p) => onProgress({ ...p, total: unique.length + files.length }), signal);
  const withFiles = await cacheUrls(
    "rce-assets-v1",
    files,
    (p) => onProgress({ done: tiles.done + p.done, total: unique.length + files.length, bytes: p.bytes }),
    signal,
    tiles.bytes,
  );

  const meta: OfflineMeta = {
    eventId: input.eventId,
    downloadedAt: new Date().toISOString(),
    tiles: unique.length,
    bytes: withFiles.bytes,
  };
  writeOfflineMeta(meta);
  return meta;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Make sure the caching/push service worker is registered (safe to call often). */
export async function ensureOfflineWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration("/push-sw.js");
    if (existing) return existing;
    return await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export function useOnlineStatus() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
