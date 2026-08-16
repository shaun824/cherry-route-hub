// Reads each event's official website for merchandise / add-on descriptions and
// keeps event_merch_options enriched with a plain-English blurb, price and
// source link. Server-only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { crawlSite } from "@/lib/event-bot-crawl.server";
import { merchKey, merchKeysMatch } from "@/lib/inclusion-meta";

export type ScrapedMerch = {
  name: string;
  description: string;
  price?: number | null;
  sourceUrl?: string | null;
};

type EventRow = {
  id: string;
  name: string;
  website_url: string | null;
  faq_url?: string | null;
};

const MERCH_HINTS =
  /(merch|shop|store|kit|apparel|clothing|jersey|extras|add[-\s]?on|package|rental|hire|what-?you-?get|inclusions|entry-?fee|includes|accommodation|services)/i;

function pickPages(pages: { url: string; text: string }[]) {
  return pages
    .map((p) => {
      let score = 0;
      if (MERCH_HINTS.test(p.url)) score += 3;
      const hits = (p.text.match(
        /\b(jersey|riding top|t[\s-]?shirt|jacket|cap|bike wash|bike service|rental|shuttle|transfer|massage|camping|chalet|includes|included)\b/gi,
      ) ?? []).length;
      score += Math.min(hits, 12) / 3;
      return { p, score };
    })
    .filter((x) => x.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.p);
}

async function extractMerch(
  eventName: string,
  knownItems: string[],
  pages: { url: string; text: string }[],
): Promise<ScrapedMerch[]> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const context = pages
    .map((p) => `SOURCE: ${p.url}\n${p.text.slice(0, 9000)}`)
    .join("\n\n---\n\n")
    .slice(0, 70000);

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You extract merchandise, apparel, add-ons and included extras for a cycling / motorsport event from scraped website text.

Return ONLY JSON: {"items":[{"name":"item name","description":"1-2 sentence rider-facing description of what it is and what's included","price":number or null,"sourceUrl":"page url"}]}

Rules:
- Only use facts stated on the pages. Never invent prices or inclusions.
- Prefer items that match the KNOWN ITEMS list (same thing, wording may differ) — use the website's wording for the description.
- Prices in South African Rand as plain numbers (no R, no spaces). null when not stated.
- Keep descriptions concrete: fabric, fit, what's in the package, how many days, what's covered.
- Max 40 items. Return an empty array when the pages list no merchandise or extras.`,
        },
        {
          role: "user",
          content: `EVENT: ${eventName}\nKNOWN ITEMS: ${knownItems.slice(0, 40).join(" | ") || "none"}\n\nPAGES:\n${context}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) throw new Error(`AI gateway ${res.status}: ${await res.text().catch(() => "")}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!raw) return [];
  let parsed: { items?: ScrapedMerch[] };
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim());
  } catch {
    return [];
  }
  return (parsed.items ?? [])
    .filter((i) => i && typeof i.name === "string" && typeof i.description === "string")
    .map((i) => ({
      name: String(i.name).trim().slice(0, 200),
      description: String(i.description).trim().slice(0, 600),
      price: i.price != null && Number.isFinite(Number(i.price)) ? Number(i.price) : null,
      sourceUrl: i.sourceUrl && /^https?:\/\//i.test(i.sourceUrl) ? i.sourceUrl : null,
    }))
    .filter((i) => i.name.length > 1 && i.description.length > 10)
    .slice(0, 40);
}

/** Scrape one event's website and enrich its merchandise catalogue. */
export async function syncEventMerchInfo(admin: SupabaseClient<any>, event: EventRow) {
  const seeds = [event.website_url, event.faq_url].filter(
    (u): u is string => Boolean(u && /^https?:\/\//i.test(u)),
  );
  if (!seeds.length) {
    return { eventId: event.id, name: event.name, found: 0, updated: 0, error: "No website configured" };
  }

  try {
    const pages = pickPages(await crawlSite(seeds, 25));
    if (!pages.length) {
      return { eventId: event.id, name: event.name, found: 0, updated: 0, error: "No merch pages found" };
    }

    const { data: rows } = await admin
      .from("event_merch_options")
      .select("id, name")
      .eq("event_id", event.id);
    const catalogue = (rows ?? []) as { id: string; name: string }[];

    const items = await extractMerch(event.name, catalogue.map((r) => r.name), pages);

    let updated = 0;
    const now = new Date().toISOString();
    for (const row of catalogue) {
      const key = merchKey(row.name);
      const hit = items.find((i) => merchKeysMatch(key, merchKey(i.name)));
      if (!hit) continue;
      const { error } = await admin
        .from("event_merch_options")
        .update({
          description: hit.description,
          price_from: hit.price,
          source_url: hit.sourceUrl,
          web_synced_at: now,
        })
        .eq("id", row.id);
      if (!error) updated += 1;
    }

    return { eventId: event.id, name: event.name, found: items.length, updated };
  } catch (err) {
    return { eventId: event.id, name: event.name, found: 0, updated: 0, error: (err as Error).message };
  }
}

/** Sync every non-archived event (scheduled job + admin button). */
export async function syncAllEventMerchInfo(admin: SupabaseClient<any>, eventId?: string) {
  let q = admin
    .from("events")
    .select("id, name, website_url, faq_url")
    .neq("lifecycle", "archived");
  if (eventId) q = q.eq("id", eventId);
  const { data: events, error } = await q;
  if (error) throw new Error(error.message);

  const results = [];
  for (const ev of events ?? []) results.push(await syncEventMerchInfo(admin, ev as EventRow));
  return { events: results.length, results };
}
