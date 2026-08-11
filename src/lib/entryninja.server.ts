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

async function enGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) {
    throw new Error(`Entry Ninja API error ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

export async function fetchEnEvents(): Promise<EnEvent[]> {
  const json = await enGet<{ data: EnEvent[] }>("/api/events");
  return json.data ?? [];
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
