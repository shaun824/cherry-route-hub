// Scrapes each event's official website for its programme / itinerary and keeps
// the app schedule in sync with it. Server-only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { crawlSite } from "@/lib/event-bot-crawl.server";

export type ScrapedScheduleItem = {
  date?: string | null; // YYYY-MM-DD when the page states one
  time: string; // "07:00", "TBC", "All day"
  label: string;
  details?: string | null;
};

type EventDay = { id: string; date: string; label?: string };

type EventRow = {
  id: string;
  name: string;
  event_date: string | null;
  website_url: string | null;
  faq_url?: string | null;
  days: EventDay[] | null;
  schedule: unknown;
};

const SCHEDULE_HINTS =
  /(schedule|programme|program|itinerary|timetable|race-?day|event-?info|the-?event|info|details|day-?1|day-?2)/i;

const GENERIC_PATH = /(schedule|programme|program|itinerary|timetable|event-?info|race-?day|faq|day-?1|day-?2)/i;

const STOP_WORDS = new Set([
  "the","and","for","with","event","events","ride","race","tour","weekend","warrior","classic","challenge",
  "cycle","cycling","mtb","bike","enduro","festival","series","presented","sponsored","by","of","de","red",
  "cherry","2024","2025","2026","2027","2028","best","north","south","edition","day","days",
]);

/**
 * Words that identify THIS leg / edition (venue, town, farm name). Multi-leg
 * series such as Weekend Warrior publish a separate schedule page per town, so
 * we must never read another town's page as if it were this event's.
 */
export function legTokens(event: { name: string; location?: string | null }): string[] {
  const raw = `${event.name} ${event.location ?? ""}`.toLowerCase();
  return Array.from(
    new Set(
      raw
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w)),
    ),
  );
}

/** Keep the pages most likely to hold THIS event's running order. */
function pickPages(
  pages: { url: string; text: string }[],
  tokens: string[] = [],
): { url: string; text: string }[] {
  const hasToken = (p: { url: string; text: string }) => {
    const hay = `${p.url} ${p.text.slice(0, 1200)}`.toLowerCase();
    return tokens.some((t) => hay.includes(t));
  };
  const anyLegPage = tokens.length > 0 && pages.some(hasToken);

  const scored = pages
    .map((p) => {
      let score = 0;
      if (SCHEDULE_HINTS.test(p.url)) score += 3;
      const timeHits = (p.text.match(/\b([01]?\d|2[0-3])[:h][0-5]\d\b/g) ?? []).length;
      score += Math.min(timeHits, 12) / 2;
      if (/registration|briefing|prize giving|prizegiving|start|finish/i.test(p.text)) score += 2;
      const own = hasToken(p);
      if (own) score += 6;
      // Another leg of the same series: no mention of this event, not a generic
      // schedule page, but full of times. Those are the pages that poisoned us.
      const otherLeg = anyLegPage && !own && !GENERIC_PATH.test(p.url);
      return { p, score, drop: otherLeg };
    })
    .filter((x) => !x.drop && x.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.p);
  return scored;
}

const RANGE_SPLIT = /\s*(?:–|—|-|to|until|till)\s*/i;

function normaliseClock(t: string): string | null {
  const m = t.trim().match(/^(\d{1,2})[:h.](\d{2})\s*(am|pm)?$/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const min = m[2];
  const ampm = m[3]?.toLowerCase();
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${min}`;
}

/** Keep real ranges ("13:30 – 17:30") intact instead of collapsing them. */
function normaliseTime(raw: string): string {
  const t = raw.trim();
  const single = normaliseClock(t);
  if (single) return single;
  const parts = t.split(RANGE_SPLIT);
  if (parts.length === 2) {
    const a = normaliseClock(parts[0] ?? "");
    const b = normaliseClock(parts[1] ?? "");
    if (a && b) return `${a} – ${b}`;
  }
  return t.slice(0, 24);
}

/** Every clock time the source pages actually print, in HH:MM form. */
function sourceTimes(pages: { text: string }[]): Set<string> {
  const found = new Set<string>();
  for (const p of pages) {
    for (const m of p.text.matchAll(/\b(\d{1,2})[:h.](\d{2})\s*(am|pm)?\b/gi)) {
      const norm = normaliseClock(`${m[1]}:${m[2]}${m[3] ? m[3] : ""}`);
      if (norm) found.add(norm);
    }
  }
  return found;
}

/**
 * Throw away anything the model produced that is not printed verbatim on the
 * scraped pages. This is what stops "plausible" invented start times.
 */
export function keepVerbatimTimes(
  items: ScrapedScheduleItem[],
  pages: { text: string }[],
): { kept: ScrapedScheduleItem[]; dropped: ScrapedScheduleItem[] } {
  const times = sourceTimes(pages);
  const kept: ScrapedScheduleItem[] = [];
  const dropped: ScrapedScheduleItem[] = [];
  for (const i of items) {
    const clocks = String(i.time).match(/\d{2}:\d{2}/g) ?? [];
    const ok = clocks.length === 0 || clocks.every((c) => times.has(c));
    (ok ? kept : dropped).push(i);
  }
  return { kept, dropped };
}

/** Separate batch/tier starts sharing one time usually means the model merged them. */
export function suspiciousMergedStarts(items: ScrapedScheduleItem[]): string[] {
  const byTime = new Map<string, Set<string>>();
  for (const i of items) {
    if (!/start/i.test(i.label)) continue;
    const set = byTime.get(i.time) ?? new Set<string>();
    set.add(i.label.toLowerCase());
    byTime.set(i.time, set);
  }
  return Array.from(byTime.entries())
    .filter(([, labels]) => labels.size > 1)
    .map(([time]) => time);
}

/** Ask the AI gateway to pull a structured running order out of the scraped text. */
async function extractSchedule(
  eventName: string,
  eventDate: string | null,
  days: EventDay[],
  pages: { url: string; text: string }[],
): Promise<ScrapedScheduleItem[]> {
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
          content: `You extract the official running order / programme for a cycling or motorsport event from scraped website text.

Return ONLY JSON of the shape {"items":[{"date":"YYYY-MM-DD or null","time":"HH:MM or 'TBC'","label":"short title","details":"optional extra info or null"}]}.

Rules:
- Only include times/activities explicitly stated on the pages. Never invent times.
- Keep labels short (registration, race briefing, batch A start, prize giving, dinner...).
- Put location/extra info in details.
- Use the event dates given to attach the correct date to each item where the page makes it clear; otherwise use null.
- Order chronologically. Return an empty items array if the pages contain no programme.`,
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
  let parsed: { items?: ScrapedScheduleItem[] };
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim());
  } catch {
    return [];
  }
  return (parsed.items ?? [])
    .filter((i) => i && typeof i.label === "string" && i.label.trim().length > 1)
    .map((i) => ({
      date: i.date && /^\d{4}-\d{2}-\d{2}$/.test(i.date) ? i.date : null,
      time: normaliseTime(String(i.time ?? "TBC")),
      label: String(i.label).trim().slice(0, 120),
      details: i.details ? String(i.details).trim().slice(0, 400) : null,
    }))
    .slice(0, 80);
}

/** Turn scraped items into the app's ScheduleItem[] (with dayId links where possible). */
export function toScheduleItems(items: ScrapedScheduleItem[], days: EventDay[]) {
  const byDate = new Map(days.map((d) => [String(d.date).slice(0, 10), d.id]));
  const mapped = items.map((i, index) => ({
    time: i.time,
    label: i.label,
    ...(i.details ? { details: i.details } : {}),
    ...(i.date && byDate.has(i.date) ? { dayId: byDate.get(i.date)! } : {}),
    _idx: index,
    _date: i.date ?? "",
  }));
  mapped.sort((a, b) => {
    if (a._date !== b._date) return a._date.localeCompare(b._date);
    return a.time.localeCompare(b.time) || a._idx - b._idx;
  });
  return mapped.map(({ _idx: _i, _date: _d, ...item }) => item);
}

function sameSchedule(a: unknown, b: unknown) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

/** Scrape one event's website and (optionally) apply the schedule it finds. */
export async function syncEventSchedule(
  admin: SupabaseClient<any>,
  event: EventRow,
  opts: { forceApply?: boolean } = {},
): Promise<{
  eventId: string;
  name: string;
  found: number;
  applied: boolean;
  verified?: boolean;
  needsReview?: boolean;
  reviewNote?: string | null;
  error?: string;
}> {
  const seeds = [event.website_url, event.faq_url].filter(
    (u): u is string => Boolean(u && /^https?:\/\//i.test(u)),
  );

  const record = async (patch: Record<string, unknown>) => {
    await admin
      .from("event_schedule_sync")
      .upsert({ event_id: event.id, updated_at: new Date().toISOString(), ...patch });
  };

  if (!seeds.length) {
    await record({ synced_at: new Date().toISOString(), last_error: "No website configured" });
    return { eventId: event.id, name: event.name, found: 0, applied: false, error: "No website configured" };
  }

  try {
    const pages = pickPages(await crawlSite(seeds, 25), legTokens(event));
    if (!pages.length) {
      await record({
        synced_at: new Date().toISOString(),
        last_error: "No schedule-like pages found",
        verified: false,
        needs_review: true,
        review_note: "No page on this event's own site looked like a running order",
      });
      return { eventId: event.id, name: event.name, found: 0, applied: false, error: "No schedule-like pages found" };
    }

    const days = (event.days ?? []) as EventDay[];
    const raw = await extractSchedule(event.name, event.event_date, days, pages);
    // Nothing goes near a rider unless the exact time is printed on the page.
    const { kept: items, dropped } = keepVerbatimTimes(raw, pages);
    const merged = suspiciousMergedStarts(items);

    const notes: string[] = [];
    if (dropped.length) notes.push(`${dropped.length} time(s) were not printed on the site and were discarded`);
    if (merged.length) notes.push(`different batches share the same start time (${merged.join(", ")})`);
    if (!items.length) notes.push("no times found on the site");
    const verified = items.length > 0 && dropped.length === 0 && merged.length === 0;
    const reviewNote = notes.length ? notes.join("; ") : null;

    const { data: existing } = await admin
      .from("event_schedule_sync")
      .select("auto_apply")
      .eq("event_id", event.id)
      .maybeSingle();
    // Default: only auto-apply when the event has no hand-built schedule yet.
    // Existing schedules are staged for admin review instead of being overwritten.
    const hasSchedule = Array.isArray(event.schedule) && event.schedule.length > 0;
    const autoApply = existing?.auto_apply ?? !hasSchedule;

    let applied = false;
    // Only a clean, verbatim-checked scrape is ever written onto the event.
    if (verified && (opts.forceApply || autoApply)) {
      const scheduleItems = toScheduleItems(items, days);
      if (!sameSchedule(scheduleItems, event.schedule)) {
        const { error } = await admin.from("events").update({ schedule: scheduleItems }).eq("id", event.id);
        if (error) throw new Error(error.message);
      }
      applied = true;
    }

    await record({
      items,
      sources: pages.map((p) => p.url),
      synced_at: new Date().toISOString(),
      applied_at: applied ? new Date().toISOString() : undefined,
      last_error: items.length ? null : "No schedule found on the website",
      verified: applied ? true : false,
      verified_at: applied ? new Date().toISOString() : null,
      needs_review: !applied,
      review_note: reviewNote,
    });

    return {
      eventId: event.id,
      name: event.name,
      found: items.length,
      applied,
      verified: applied,
      needsReview: !applied,
      reviewNote,
    };
  } catch (err) {
    const message = (err as Error).message;
    await record({ synced_at: new Date().toISOString(), last_error: message });
    return { eventId: event.id, name: event.name, found: 0, applied: false, error: message };
  }
}

/** Sync every non-archived event (used by the scheduled job and the admin button). */
export async function syncAllEventSchedules(admin: SupabaseClient<any>, opts: { forceApply?: boolean } = {}) {
  const { data: events, error } = await admin
    .from("events")
    .select("id, name, event_date, website_url, faq_url, days, schedule")
    .neq("lifecycle", "archived");
  if (error) throw new Error(error.message);

  const results = [];
  for (const ev of events ?? []) {
    results.push(await syncEventSchedule(admin, ev as EventRow, opts));
  }
  return { events: results.length, results };
}
