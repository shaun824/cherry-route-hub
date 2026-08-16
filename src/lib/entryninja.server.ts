// Server-only Entry Ninja API client.
const BASE = "https://api.entryninja.com";

export type EnEvent = {
  id: number;
  name: string;
  date: string | null;
  organiser?: { company?: string | null } | null;
  venue?: {
    name?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    coordinates?: { lat?: number | null; lng?: number | null } | null;
  } | null;
};

export type EnEntry = {
  id: number;
  registration_reference?: string | null;
  paid?: boolean;
  race_number?: string | null;
  checked_in?: boolean;
  class?: { id: number; name: string; distance?: string | null } | null;
  batch?: { id: number; name: string; start?: string | null } | null;
  extra?: { item?: { name?: string } | null; option?: { name?: string } | null; quantity?: number }[] | null;
  merchandise?: { item?: { name?: string } | null; option?: { name?: string } | null }[] | null;
  entrant?: {
    id: number;
    first_name?: string | null;
    last_name?: string | null;
    id_number?: string | null;
    email?: string | null;
    cell_phone_number?: string | null;
  } | null;
};

function apiKey(): string {
  const key = process.env["ENTRY_NINJA_API_KEY"];
  if (!key) throw new Error("Entry Ninja API key is not configured.");
  return key;
}

async function enGet<T>(path: string, attempt = 0): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) {
    // Entry Ninja throttles bursts with 429/403 — back off and retry a few times.
    if ((res.status === 429 || res.status === 403 || res.status >= 500) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      return enGet<T>(path, attempt + 1);
    }
    throw new Error(`Entry Ninja API error ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

/**
 * The events endpoint is paginated (10 per page) and page 1 only contains the
 * events still open for entry — past events live on later pages. Walk every
 * page so history lookups can see the full archive.
 */
export async function fetchEnEvents(maxPages = 40): Promise<EnEvent[]> {
  const out: EnEvent[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const json = await enGet<{ data: EnEvent[]; meta?: { current_page: number; last_page: number } }>(
      `/api/events?page=${page}`,
    );
    out.push(...(json.data ?? []));
    const meta = json.meta;
    if (!meta || meta.current_page >= meta.last_page) break;
  }
  return out;
}


export async function fetchEnEntries(eventId: number, maxPages = 40): Promise<EnEntry[]> {
  const out: EnEntry[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const json = await enGet<{ data: EnEntry[]; meta?: { current_page: number; last_page: number } }>(
      `/api/entries?event_id=${eventId}&per_page=100&page=${page}`,
    );
    out.push(...(json.data ?? []));
    const meta = json.meta;
    if (!meta || meta.current_page >= meta.last_page) break;
  }
  return out;
}

const SIZE_WORDS =
  /^(xxs|xs|s|m|l|xl|2xl|3xl|4xl|xxl|xxxl|small|medium|large|x-?large|xx-?large|extra small|extra large|\d{2})$/i;

export function normaliseSize(option: string | null | undefined): string | null {
  const s = (option ?? "").trim();
  if (!s) return null;
  if (!SIZE_WORDS.test(s)) return null;
  const map: Record<string, string> = {
    small: "S",
    medium: "M",
    large: "L",
    "x-large": "XL",
    xlarge: "XL",
    "xx-large": "XXL",
    xxlarge: "XXL",
    "extra small": "XS",
    "extra large": "XL",
  };
  const lower = s.toLowerCase();
  return (map[lower] ?? s).toUpperCase();
}

// Entry Ninja returns merchandise/extra as an array on some events and as a
// keyed object (or null) on others — normalise both to a flat array.
export type EnLine = { item?: { name?: string } | null; option?: { name?: string } | null; quantity?: number };

export function toLineArray(value: unknown): EnLine[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as EnLine[];
  if (typeof value === "object") return Object.values(value as Record<string, EnLine>).filter(Boolean);
  return [];
}

// Entry Ninja exposes merchandise/extra pricing under a few different keys
// depending on the event setup — pick the first sensible number we find.
export function linePrice(line: unknown): number | null {
  if (!line || typeof line !== "object") return null;
  const l = line as Record<string, any>;
  const candidates = [l["price"], l["amount"], l["unit_price"], l["total"], l["item"]?.price, l["option"]?.price];
  for (const c of candidates) {
    const n = typeof c === "string" ? Number(c.replace(/[^0-9.]/g, "")) : Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export type EnMerchItem = {
  id: number;
  name: string;
  options?: { id: number; name: string; price?: number | string | null }[] | null;
  price?: number | string | null;
};

export type EnEventDetail = EnEvent & {
  extra?: { name?: string; question?: string }[] | null;
  available_merchandise?: EnMerchItem[] | null;
};

export async function fetchEnEventDetail(enEventId: number): Promise<EnEventDetail> {
  const json = await enGet<{ data: EnEventDetail }>(`/api/events/${enEventId}`);
  return json.data;
}
