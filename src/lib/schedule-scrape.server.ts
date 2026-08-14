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

/** Keep the pages most likely to hold a running order, plus a few fallbacks. */
function pickPages(pages: { url: string; text: string }[]): { url: string; text: string }[] {
  const scored = pages
    .map((p) => {
      let score = 0;
      if (SCHEDULE_HINTS.test(p.url)) score += 3;
      const timeHits = (p.text.match(/\b([01]?\d|2[0-3])[:h][0-5]\d\b/g) ?? []).length;
      score += Math.min(timeHits, 12) / 2;
      if (/registration|briefing|prize giving|prizegiving|start|finish/i.test(p.text)) score += 2;
      return { p, score };
    })
    .filter((x) => x.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.p);
  return scored;
}

function normaliseTime(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^(\d{1,2})[:h.](\d{2})\s*(am|pm)?$/i);
  if (m) {
    let hour = Number(m[1]);
    const min = m[2];
    const ampm = m[3]?.toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${min}`;
  }
  return t.slice(0, 24);
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
): Promise<{ eventId: string; name: string; found: number; applied: boolean; error?: string }> {
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
    const pages = pickPages(await crawlSite(seeds, 25));
    if (!pages.length) {
      await record({ synced_at: new Date().toISOString(), last_error: "No schedule-like pages found" });
      return { eventId: event.id, name: event.name, found: 0, applied: false, error: "No schedule-like pages found" };
    }

    const days = (event.days ?? []) as EventDay[];
    const items = await extractSchedule(event.name, event.event_date, days, pages);

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
    if (items.length && (opts.forceApply || autoApply)) {
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
    });

    return { eventId: event.id, name: event.name, found: items.length, applied };
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
