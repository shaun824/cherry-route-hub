/**
 * Read-only client for the Myriad Events results feed.
 * Docs: https://events.myriadevents.co.za/Rest — public, no API key.
 *
 * Shape: Race (RaceId) → Events (start groups) → Result sets → Results.
 * Only the RaceId is stored by us; everything below it is looked up each time
 * because the ids change with every edition of a race.
 */
import { parseTimeMs } from "@/lib/results.server";
import type { ResultRow, ResultSet } from "@/lib/results.functions";

const BASE = "https://events.myriadevents.co.za/Rest";
/** The feed itself caches for 30s, so caching longer here buys nothing. */
const CACHE_MS = 30_000;

export type MyriadRaceEvent = { event_id: number; name: string; start_time: string | null };
export type MyriadRace = {
  race_id: number;
  name: string;
  last_date: string | null;
  next_date: string | null;
  timezone: string | null;
  url: string | null;
  logo_url: string | null;
  events: MyriadRaceEvent[];
};

export type MyriadLap = { lap: number; time: string; pace: string; distanceKm: number };

type CacheEntry = { at: number; value: unknown };
const cache = new Map<string, CacheEntry>();

export class MyriadError extends Error {
  code: number | null;
  /** True when the request was cut off by our own timeout, not answered with an error. */
  timedOut: boolean;
  constructor(message: string, code: number | null = null, timedOut = false) {
    super(message);
    this.name = "MyriadError";
    this.code = code;
    this.timedOut = timedOut;
  }
}


async function getJson<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  opts: { timeoutMs?: number; retryTimeouts?: boolean } = {},
) {
  const qs = new URLSearchParams({ format: "json" });
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const url = `${BASE}${path}?${qs.toString()}`;

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;

  // The timing host intermittently returns 5xx (Cloudflare 502/522/524) and sometimes
  // stalls for ~40s on empty start groups; cap each try and retry briefly.
  const TIMEOUT_MS = opts.timeoutMs ?? 6_000;

  let res: Response | null = null;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status < 500) break;
    } catch (err) {
      lastErr = err;
      res = null;
      // A timeout usually means that start group is stalling; don't queue behind it again.
      if (
        !opts.retryTimeouts &&
        err instanceof Error &&
        (err.name === "TimeoutError" || err.name === "AbortError")
      )
        break;

    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }


  if (!res) {
    const timedOut =
      lastErr instanceof Error && (lastErr.name === "TimeoutError" || lastErr.name === "AbortError");
    throw new MyriadError(
      `The results feed could not be reached${lastErr instanceof Error ? `: ${lastErr.message}` : "."}`,
      null,
      timedOut,
    );
  }

  if (!res.ok) {
    throw new MyriadError(
      res.status === 405
        ? "The results feed only accepts read requests."
        : `The results feed replied with ${res.status}.`,
    );
  }

  const json = (await res.json()) as any;
  // The feed reports data errors with HTTP 200 and a top-level error object.
  if (json?.error) {
    throw new MyriadError(
      String(json.error.error_msg ?? "The results feed reported an error."),
      json.error.error_code == null ? null : Number(json.error.error_code),
    );
  }
  cache.set(url, { at: Date.now(), value: json });
  return json as T;
}

/** Chapter 2: the race and the events (start groups) inside it. */
export async function fetchRace(
  raceId: string,
  opts: { mostRecentOnly?: boolean } = {},
): Promise<MyriadRace> {
  const json = await getJson<any>(
    `/race/${encodeURIComponent(raceId)}`,
    { most_recent_events_only: opts.mostRecentOnly ? "T" : undefined },
    { timeoutMs: 15_000, retryTimeouts: true },
  );

  const race = json?.race ?? {};
  return {
    race_id: Number(race.race_id ?? raceId),
    name: String(race.name ?? "Race"),
    last_date: race.last_date ?? null,
    next_date: race.next_date ?? null,
    timezone: race.timezone ?? null,
    url: race.url ?? null,
    logo_url: race.logo_url ?? null,
    events: (race.events ?? []).map((e: any) => ({
      event_id: Number(e.event_id),
      name: String(e.name ?? ""),
      start_time: e.start_time ?? null,
    })),
  };
}

type RawSet = {
  individual_result_set_id: number;
  individual_result_set_name: string;
  sort_order?: number;
  preliminary_results?: string;
  num_finishers?: number;
  results_headers?: Record<string, string>;
  results?: Record<string, unknown>[];
};

/** Chapter 4/5: results of one event, optionally filtered to a participant. */
async function fetchEventResultSets(
  raceId: string,
  eventId: number,
  params: Record<string, string | number | undefined> = {},
  opts: { timeoutMs?: number } = {},
): Promise<RawSet[]> {
  const json = await getJson<any>(
    `/race/${encodeURIComponent(raceId)}/results/get-results`,
    { event_id: eventId, include_total_finishers: "T", ...params },
    opts,
  );
  return (json?.individual_results_sets ?? []) as RawSet[];
}

/** All pages of one event's results (the feed pages 50 at a time). */
async function fetchAllPages(
  raceId: string,
  eventId: number,
  opts: { timeoutMs?: number } = {},
): Promise<RawSet[]> {
  const perPage = 50;
  const first = await fetchEventResultSets(
    raceId,
    eventId,
    { page: 1, results_per_page: perPage },
    opts,
  );
  const merged = first.map((s) => ({ ...s, results: [...(s.results ?? [])] }));

  const maxFinishers = Math.max(0, ...merged.map((s) => Number(s.num_finishers ?? 0)));
  const pages = Math.min(Math.ceil(maxFinishers / perPage), 40); // hard cap: 2000 rows / event
  for (let page = 2; page <= pages; page++) {
    const next = await fetchEventResultSets(
      raceId,
      eventId,
      { page, results_per_page: perPage },
      opts,
    );
    let added = 0;
    for (const set of next) {
      const target = merged.find(
        (s) => s.individual_result_set_id === set.individual_result_set_id,
      );
      if (target) {
        target.results.push(...(set.results ?? []));
        added += (set.results ?? []).length;
      } else {
        merged.push({ ...set, results: [...(set.results ?? [])] });
        added += (set.results ?? []).length;
      }
    }
    if (added === 0) break;
  }
  return merged;
}


/** The feed rate-limits bursts (returns 5xx), so keep requests to a few at a time. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>) {
  const out = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= items.length) return;
        out[i] = await fn(items[i] as T, i);
      }
    }),
  );
  return out;
}



function stripTags(v: string) {
  return v.replace(/<[^>]*>/g, "").trim();
}

/** Finds a column key by its human label, e.g. "Lap Details". */
export function findColumn(headers: Record<string, string>, label: string) {
  return Object.keys(headers ?? {}).find(
    (key) => (headers[key] ?? "").trim().toLowerCase() === label.toLowerCase(),
  );
}

/** Parses the tab/newline "Lap Details" table into lap rows. */
export function parseLapDetails(text: string | undefined | null): MyriadLap[] {
  if (!text) return [];
  return String(text)
    .split("\n")
    .slice(1)
    .filter((row) => row.trim() !== "")
    .map((row) => {
      const [lap, time, pace, distance] = row.split("\t").map((c) => stripTags(c ?? ""));
      return {
        lap: Number(lap),
        time: time ?? "",
        pace: pace ?? "",
        distanceKm: Number(distance),
      };
    })
    .filter((l) => Number.isFinite(l.lap));
}

const CORE_KEYS = new Set([
  "result_id",
  "place",
  "bib",
  "first_name",
  "last_name",
  "clock_time",
  "chip_time",
]);

function toRow(raw: Record<string, any>, set: RawSet): ResultRow {
  const headers = set.results_headers ?? {};
  const timeText = String(raw["clock_time"] ?? "").trim() || String(raw["chip_time"] ?? "").trim();
  const extras: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (CORE_KEYS.has(key)) continue;
    if (value == null || String(value).trim() === "") continue;
    const label = headers[key] ?? key;
    extras[label] = stripTags(String(value));
  }
  const fullName = [raw["first_name"], raw["last_name"]]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(" ");

  return {
    id: `myriad-${set.individual_result_set_id}-${raw["result_id"] ?? raw["bib"] ?? fullName}`,
    result_set_id: `myriad-${set.individual_result_set_id}`,
    bib_number: raw["bib"] == null ? null : String(raw["bib"]),
    full_name: fullName || String(raw["bib"] ?? "Unnamed"),
    category: (extras["Category"] as string | undefined) ?? null,
    batch: null,
    position: raw["place"] == null ? null : Number(raw["place"]),
    time_text: timeText || null,
    time_ms: parseTimeMs(timeText),
    gap_text: null,
    status: set.preliminary_results === "T" ? "provisional" : null,
    extras,
  };
}

export type MyriadNormalised = { sets: ResultSet[]; rows: ResultRow[] };

function normalise(raceEventName: string, sets: RawSet[], baseOrder: number): MyriadNormalised {
  const outSets: ResultSet[] = [];
  const outRows: ResultRow[] = [];
  sets.forEach((set, i) => {
    if (!set?.individual_result_set_id) return;
    const rows = (set.results ?? []).map((r) => toRow(r as Record<string, any>, set));
    if (rows.length === 0) return;
    outSets.push({
      id: `myriad-${set.individual_result_set_id}`,
      label: String(set.individual_result_set_name || raceEventName),
      kind: set.preliminary_results === "T" ? "provisional" : "overall",
      sort_order: baseOrder * 100 + Number(set.sort_order ?? i),
      imported_at: new Date().toISOString(),
    });
    outRows.push(...rows);
  });
  return { sets: outSets, rows: outRows };
}

/** Everything published for a race, normalised into the app's results shape. */
export async function fetchRaceResults(raceId: string): Promise<MyriadNormalised> {
  const race = await fetchRace(raceId, { mostRecentOnly: true });
  const parts = await mapLimit(race.events, 4, async (ev, i) => {
    try {
      const sets = await fetchAllPages(raceId, ev.event_id);
      return normalise(ev.name, sets, i);
    } catch {
      return { sets: [], rows: [] } as MyriadNormalised;
    }
  });

  return {
    sets: parts.flatMap((p) => p.sets).sort((a, b) => a.sort_order - b.sort_order),
    rows: parts.flatMap((p) => p.rows),
  };
}

/** Chapter 5: find one participant across every event of a race. */
export async function findRaceParticipant(
  raceId: string,
  query: { lastName?: string; bib?: string },
): Promise<{ eventName: string; sets: ResultSet[]; rows: ResultRow[] }[]> {
  const race = await fetchRace(raceId, { mostRecentOnly: true });
  const found = await mapLimit(race.events, 4, async (ev, i) => {
    try {
      const sets = await fetchEventResultSets(raceId, ev.event_id, {
        last_name: query.lastName,
        bib_num: query.bib,
      });
      const n = normalise(ev.name, sets, i);
      return n.rows.length ? { eventName: ev.name, ...n } : null;
    } catch {
      return null;
    }
  });

  return found.filter(Boolean) as { eventName: string; sets: ResultSet[]; rows: ResultRow[] }[];
}
