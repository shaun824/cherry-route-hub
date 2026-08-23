// Scrapes each event's official website for where the event moves to each
// night (overnight venues / race villages) and stages the result for admin
// review. Server-only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { crawlSite } from "@/lib/event-bot-crawl.server";

export type ScrapedStay = {
  nightIndex: number | null; // 1 = first night of the event
  date?: string | null; // YYYY-MM-DD when the page states one
  venue: string; // "Fynbos Ridge Country House"
  town?: string | null;
  address?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  notes?: string | null;
  source?: string | null;
};

type EventDay = { id: string; date: string; label?: string };

type EventRow = {
  id: string;
  name: string;
  event_date: string | null;
  website_url: string | null;
  faq_url?: string | null;
  days: EventDay[] | null;
};

const VENUE_HINTS =
  /(accommodation|accomodation|venue|village|camp|overnight|stay|lodge|route|day-?1|day-?2|day-?3|itinerary|programme|program|info|details|tour)/i;

/** Keep the pages most likely to describe where riders sleep each night. */
function pickPages(pages: { url: string; text: string }[]) {
  return pages
    .map((p) => {
      let score = 0;
      if (VENUE_HINTS.test(p.url)) score += 3;
      const hits = (
        p.text.match(
          /\b(overnight|accommodation|accomodation|race village|tented|camp|lodge|guest house|check[- ]?in|check[- ]?out|night \d)\b/gi,
        ) ?? []
      ).length;
      score += Math.min(hits, 12) / 2;
      return { p, score };
    })
    .filter((x) => x.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.p);
}

function cleanTime(raw: unknown): string | null {
  if (!raw) return null;
  const t = String(raw).trim();
  return t ? t.slice(0, 24) : null;
}

/** Ask the AI gateway to pull the night-by-night venue list out of the pages. */
async function extractStays(
  eventName: string,
  eventDate: string | null,
  days: EventDay[],
  pages: { url: string; text: string }[],
): Promise<ScrapedStay[]> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const context = pages
    .map((p) => `SOURCE: ${p.url}\n${p.text.slice(0, 9000)}`)
    .join("\n\n---\n\n")
    .slice(0, 70000);

  const dayList = days.length
    ? days.map((d) => `${d.date}${d.label ? ` (${d.label})` : ""}`).join(", ")
    : "unknown";

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You extract where a multi-day cycling or motorsport event moves to, night by night, from scraped website text.

Return ONLY JSON of the shape {"stays":[{"nightIndex":1,"date":"YYYY-MM-DD or null","venue":"name","town":"town or null","address":"address or null","checkIn":"time or null","checkOut":"time or null","notes":"short extra info or null","source":"page url"}]}.

Rules:
- Only include venues explicitly named on the pages. Never invent a venue, address or time.
- nightIndex is 1 for the first night riders sleep at the event, 2 for the second, and so on. Use null when the pages do not make the order clear.
- One entry per night per venue. If riders stay at the same venue for two nights, return two entries (nightIndex 1 and 2) with the same venue.
- Ignore start/finish points that riders do not sleep at, unless the page says they overnight there.
- Put anything else useful (tented camp, guest houses, own arrangements) in notes.
- Return an empty stays array if the pages never say where riders sleep.`,
        },
        {
          role: "user",
          content: `EVENT: ${eventName}\nSTART DATE: ${eventDate ?? "unknown"}\nEVENT DAYS: ${dayList}\n\nPAGES:\n${context}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    throw new Error(`AI gateway ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!raw) return [];
  let parsed: { stays?: ScrapedStay[] };
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim());
  } catch {
    return [];
  }

  return (parsed.stays ?? [])
    .filter((s) => s && typeof s.venue === "string" && s.venue.trim().length > 2)
    .map((s) => ({
      nightIndex:
        typeof s.nightIndex === "number" && s.nightIndex > 0 && s.nightIndex < 30
          ? Math.round(s.nightIndex)
          : null,
      date: s.date && /^\d{4}-\d{2}-\d{2}$/.test(String(s.date)) ? String(s.date) : null,
      venue: String(s.venue).trim().slice(0, 120),
      town: s.town ? String(s.town).trim().slice(0, 80) : null,
      address: s.address ? String(s.address).trim().slice(0, 200) : null,
      checkIn: cleanTime(s.checkIn),
      checkOut: cleanTime(s.checkOut),
      notes: s.notes ? String(s.notes).trim().slice(0, 300) : null,
      source: s.source ? String(s.source).slice(0, 300) : null,
    }))
    .sort((a, b) => (a.nightIndex ?? 99) - (b.nightIndex ?? 99))
    .slice(0, 30);
}

/** One row per venue, covering every night riders sleep there. */
export function toVenueRows(stays: ScrapedStay[]) {
  type Row = {
    name: string;
    address: string | null;
    notes: string | null;
    night_start: number | null;
    nights: number | null;
    check_in: string | null;
    check_out: string | null;
  };
  const byName = new Map<string, { row: Row; nights: Set<number> }>();

  for (const s of stays) {
    const key = s.venue.trim().toLowerCase();
    const entry = byName.get(key);
    if (entry) {
      if (s.nightIndex != null) entry.nights.add(s.nightIndex);
      entry.row.address ??= s.address ?? s.town ?? null;
      entry.row.notes ??= s.notes ?? null;
      entry.row.check_in ??= s.checkIn ?? null;
      if (s.checkOut) entry.row.check_out = s.checkOut;
      continue;
    }
    byName.set(key, {
      row: {
        name: s.venue.trim(),
        address: s.address ?? s.town ?? null,
        notes: s.notes ?? null,
        night_start: s.nightIndex,
        nights: null,
        check_in: s.checkIn ?? null,
        check_out: s.checkOut ?? null,
      },
      nights: new Set(s.nightIndex != null ? [s.nightIndex] : []),
    });
  }

  return Array.from(byName.values())
    .map(({ row, nights }) => {
      const list = Array.from(nights).sort((a, b) => a - b);
      if (list.length) {
        row.night_start = list[0]!;
        row.nights = list[list.length - 1]! - list[0]! + 1;
      }
      return row;
    })
    .sort((a, b) => (a.night_start ?? 99) - (b.night_start ?? 99));
}


/** Write the scraped venues onto event_venues, matching existing rows by name. */
export async function applyVenueRows(
  admin: SupabaseClient<any>,
  eventId: string,
  stays: ScrapedStay[],
) {
  const all = toVenueRows(stays);
  // Drop vague entries (e.g. just a town name) when a properly named venue covers it.
  const rows = all.filter(
    (r) =>
      !all.some(
        (other) =>
          other !== r &&
          other.name.toLowerCase().includes(r.name.toLowerCase()) &&
          other.name.length > r.name.length,
      ),
  );
  if (!rows.length) return { created: 0, updated: 0 };

  const { data: existing } = await admin
    .from("event_venues")
    .select("id, name, address, notes, sort_order")
    .eq("event_id", eventId);

  const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const findExisting = (name: string) => {
    const target = norm(name);
    return (
      (existing ?? []).find((v: any) => norm(v.name) === target) ??
      (existing ?? []).find(
        (v: any) => norm(v.name).includes(target) || target.includes(norm(v.name)),
      )
    );
  };

  let created = 0;
  let updated = 0;
  let sort = (existing ?? []).length;

  for (const row of rows) {
    const match = findExisting(row.name);

    if (match) {
      const { error } = await admin
        .from("event_venues")
        .update({
          address: row.address ?? match.address,
          notes: row.notes ?? match.notes,
          night_start: row.night_start,
          nights: row.nights,
          check_in: row.check_in,
          check_out: row.check_out,
        })
        .eq("id", match.id);
      if (error) throw new Error(error.message);
      updated += 1;
    } else {
      const { error } = await admin.from("event_venues").insert({
        event_id: eventId,
        name: row.name,
        address: row.address,
        notes: row.notes,
        night_start: row.night_start,
        nights: row.nights,
        check_in: row.check_in,
        check_out: row.check_out,
        sort_order: sort++,
      });
      if (error) throw new Error(error.message);
      created += 1;
    }
  }
  return { created, updated };
}

/** Scrape one event's website for its overnight venues. */
export async function syncEventVenues(
  admin: SupabaseClient<any>,
  event: EventRow,
  opts: { apply?: boolean } = {},
): Promise<{ eventId: string; name: string; found: number; applied: boolean; error?: string }> {
  const seeds = [event.website_url, event.faq_url].filter(
    (u): u is string => Boolean(u && /^https?:\/\//i.test(u)),
  );

  const record = async (patch: Record<string, unknown>) => {
    await admin
      .from("event_venue_sync")
      .upsert({ event_id: event.id, updated_at: new Date().toISOString(), ...patch });
  };

  if (!seeds.length) {
    await record({ synced_at: new Date().toISOString(), last_error: "No website configured" });
    return { eventId: event.id, name: event.name, found: 0, applied: false, error: "No website configured" };
  }

  try {
    const pages = pickPages(await crawlSite(seeds, 25));
    if (!pages.length) {
      await record({ synced_at: new Date().toISOString(), last_error: "No accommodation pages found" });
      return {
        eventId: event.id,
        name: event.name,
        found: 0,
        applied: false,
        error: "No accommodation pages found",
      };
    }

    const stays = await extractStays(event.name, event.event_date, (event.days ?? []) as EventDay[], pages);

    let applied = false;
    if (stays.length && opts.apply) {
      await applyVenueRows(admin, event.id, stays);
      applied = true;
    }

    await record({
      stays,
      sources: pages.map((p) => p.url),
      synced_at: new Date().toISOString(),
      applied_at: applied ? new Date().toISOString() : undefined,
      last_error: stays.length ? null : "No overnight venues found on the website",
    });

    return { eventId: event.id, name: event.name, found: stays.length, applied };
  } catch (err) {
    const message = (err as Error).message;
    await record({ synced_at: new Date().toISOString(), last_error: message });
    return { eventId: event.id, name: event.name, found: 0, applied: false, error: message };
  }
}

/** Scrape every non-archived event (scheduled job + admin "check all" button). */
export async function syncAllEventVenues(admin: SupabaseClient<any>, opts: { apply?: boolean } = {}) {
  const { data: events, error } = await admin
    .from("events")
    .select("id, name, event_date, website_url, faq_url, days")
    .neq("lifecycle", "archived");
  if (error) throw new Error(error.message);

  const results = [];
  for (const ev of events ?? []) {
    results.push(await syncEventVenues(admin, ev as EventRow, opts));
  }
  return { events: results.length, results };
}
