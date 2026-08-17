// Server function that fetches an elevation profile for a route. Route files
// often carry no altitude (every point is 0), so we look the terrain up.
// Providers are tried in order: Google (via the Lovable connector, when keys
// exist) → Open-Meteo → OpenTopoData. Lookups are queued (never fired in
// parallel), retried with backoff on rate limits, and cached in memory so the
// six routes of a multi-day event don't hammer the same provider.

type Coord = [number, number]; // [lng, lat]

const CACHE = new Map<string, { at: number; elevations: number[] }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

function cacheKey(coords: Coord[]): string {
  // Round to ~1m so tiny float noise still hits the cache.
  return coords.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(";");
}

// Serialises every provider request across concurrent callers.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string, attempts = 4): Promise<Response | null> {
  let delay = 400;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
      // 429 / 5xx are transient — back off and try again.
      if (res.status !== 429 && res.status < 500) return null;
    } catch {
      /* network hiccup — retry */
    }
    await sleep(delay);
    delay *= 2;
  }
  return null;
}

/** Open-Meteo terrain model. Max 100 locations per request. */
async function openMeteo(coords: Coord[]): Promise<number[] | null> {
  const out: number[] = [];
  for (let start = 0; start < coords.length; start += 100) {
    const batch = coords.slice(start, start + 100);
    const params = new URLSearchParams({
      latitude: batch.map(([, lat]) => lat.toFixed(6)).join(","),
      longitude: batch.map(([lng]) => lng.toFixed(6)).join(","),
    });
    const res = await fetchWithRetry(`https://api.open-meteo.com/v1/elevation?${params}`);
    if (!res) return null;
    const payload = (await res.json()) as { elevation?: number[] };
    if (!payload.elevation || payload.elevation.length !== batch.length) return null;
    out.push(...payload.elevation);
    if (start + 100 < coords.length) await sleep(250);
  }
  return out;
}

/** OpenTopoData (SRTM 30m) fallback. Max 100 locations per request. */
async function openTopoData(coords: Coord[]): Promise<number[] | null> {
  const out: number[] = [];
  for (let start = 0; start < coords.length; start += 100) {
    const batch = coords.slice(start, start + 100);
    const locations = batch.map(([lng, lat]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join("|");
    const res = await fetchWithRetry(
      `https://api.opentopodata.org/v1/srtm30m?locations=${encodeURIComponent(locations)}`,
      3,
    );
    if (!res) return null;
    const payload = (await res.json()) as { results?: { elevation?: number | null }[] };
    if (!payload.results || payload.results.length !== batch.length) return null;
    const values = payload.results.map((r) => (typeof r.elevation === "number" ? r.elevation : null));
    if (values.some((v) => v === null)) return null;
    out.push(...(values as number[]));
    if (start + 100 < coords.length) await sleep(1100); // 1 call/sec limit
  }
  return out;
}

async function googleElevation(coords: Coord[]): Promise<number[] | null> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const gmapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !gmapsKey) return null;
  const out: number[] = [];
  for (let start = 0; start < coords.length; start += 200) {
    const batch = coords.slice(start, start + 200);
    const locations = batch.map(([lng, lat]) => `${lat},${lng}`).join("|");
    try {
      const res = await fetch(
        `https://connector-gateway.lovable.dev/google_maps/maps/api/elevation/json?locations=${encodeURIComponent(locations)}`,
        { headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmapsKey } },
      );
      if (!res.ok) return null;
      const payload = (await res.json()) as {
        status?: string;
        results?: { elevation?: number }[];
      };
      if (payload.status !== "OK" || !payload.results || payload.results.length !== batch.length) {
        return null;
      }
      out.push(...payload.results.map((r) => r.elevation ?? 0));
    } catch {
      return null;
    }
  }
  return out;
}


/** Looks up (and caches) terrain elevations for a sampled polyline. */
export async function lookupElevations(coords: Coord[]): Promise<number[] | null> {
  const key = cacheKey(coords);
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.elevations;

  const elevations = await enqueue(async () => {
    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.elevations;
    return (
      (await googleElevation(coords)) ??
      (await openMeteo(coords)) ??
      (await openTopoData(coords))
    );
  });

  if (!elevations || elevations.length !== coords.length) return null;
  CACHE.set(key, { at: Date.now(), elevations });
  if (CACHE.size > 200) CACHE.delete(CACHE.keys().next().value as string);
  return elevations;
}

/** Total ascent using a 1.5m noise threshold, plus the raw profile. */
export function summarise(elevations: number[]) {
  let gain = 0;
  let last: number | null = null;
  for (const elevation of elevations) {
    if (last !== null) {
      const d = elevation - last;
      if (d > 1.5) gain += d;
    }
    last = elevation;
  }
  return { totalGainM: Math.round(gain), profile: elevations };
}

export type { Coord };
