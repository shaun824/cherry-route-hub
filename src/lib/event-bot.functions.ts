import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BOT_MISS_SENTINEL = "NEEDS_ADMIN";

const AskInput = z.object({
  eventId: z.string().uuid(),
  question: z.string().trim().min(1).max(1000),
});

// ---------- HTML → text ----------

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinks(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:"))
      continue;
    try {
      const u = new URL(href, base);
      if (u.hostname !== base.hostname) continue;
      // Skip binary/asset extensions.
      if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|mp3|ico|css|js)(\?|$)/i.test(u.pathname)) continue;
      u.hash = "";
      out.add(u.toString());
    } catch {
      /* ignore */
    }
  }
  return Array.from(out);
}

// ---------- multi-page scrape with cache ----------

type CachedPage = { text: string; html: string; fetchedAt: number };
const pageCache = new Map<string, CachedPage>();
const PAGE_TTL_MS = 15 * 60 * 1000; // 15 min

async function fetchPage(url: string): Promise<CachedPage | null> {
  const cached = pageCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < PAGE_TTL_MS) return cached;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RedCherryEventsBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    const html = await res.text();
    const text = stripHtmlToText(html);
    const page = { text, html, fetchedAt: Date.now() };
    pageCache.set(url, page);
    return page;
  } catch {
    return null;
  }
}

// Score links by how likely they are to contain rider-relevant info.
function scoreLink(url: string): number {
  const u = url.toLowerCase();
  let score = 0;
  const keywords = [
    "faq",
    "info",
    "rider",
    "route",
    "schedule",
    "programme",
    "program",
    "venue",
    "accommodation",
    "camp",
    "package",
    "package",
    "entry",
    "entries",
    "price",
    "prize",
    "category",
    "categories",
    "rules",
    "safety",
    "medical",
    "start",
    "finish",
    "distance",
    "elevation",
    "map",
    "gpx",
    "kml",
    "kit",
    "pack",
    "seed",
    "batch",
    "sponsor",
    "about",
    "contact",
    "logistics",
    "transfer",
    "shuttle",
    "food",
    "meal",
    "beverage",
    "water",
    "waterpoint",
    "check-in",
    "registration",
    "day-1",
    "day-2",
    "day-3",
    "day1",
    "day2",
    "day3",
  ];
  for (const k of keywords) if (u.includes(k)) score += 3;
  // Prefer shallow paths.
  const depth = (new URL(url).pathname.match(/\//g)?.length ?? 1) - 1;
  score -= depth;
  return score;
}

async function crawlSite(seedUrls: string[], maxPages = 8): Promise<{ url: string; text: string }[]> {
  const visited = new Set<string>();
  const results: { url: string; text: string }[] = [];
  const queue: string[] = [];

  for (const s of seedUrls) if (s) queue.push(s);

  // Seed pages first.
  for (const url of queue.slice()) {
    if (visited.has(url) || results.length >= maxPages) continue;
    visited.add(url);
    const page = await fetchPage(url);
    if (!page) continue;
    results.push({ url, text: page.text });
    // Gather candidate links.
    const links = extractLinks(page.html, url)
      .filter((l) => !visited.has(l))
      .map((l) => ({ l, score: scoreLink(l) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((x) => x.l);
    for (const l of links) if (!queue.includes(l)) queue.push(l);
  }

  // BFS remaining until cap.
  while (queue.length && results.length < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    const page = await fetchPage(url);
    if (!page) continue;
    if (page.text.length < 200) continue; // skip near-empty pages
    results.push({ url, text: page.text });
  }

  return results;
}

// ---------- structured event context ----------

function formatEventStructured(event: any, info: any | null): string {
  const lines: string[] = [];
  lines.push(`Event name: ${event.name}`);
  if (event.event_date) lines.push(`Start date: ${new Date(event.event_date).toDateString()}`);
  if (event.location) lines.push(`Location: ${event.location}`);
  if (event.description) lines.push(`Description: ${event.description}`);

  const days = Array.isArray(event.days) ? event.days : [];
  if (days.length) {
    lines.push("\nDays:");
    for (const d of days) {
      lines.push(`- ${d.label ?? d.name ?? "Day"}${d.date ? ` (${d.date})` : ""}`);
    }
  }

  const schedule = Array.isArray(event.schedule) ? event.schedule : [];
  if (schedule.length) {
    lines.push("\nSchedule:");
    for (const s of schedule) {
      const bits = [s.time, s.title, s.details].filter(Boolean).join(" — ");
      lines.push(`- ${bits}`);
    }
  }

  const routes = Array.isArray(event.routes) ? event.routes : [];
  if (routes.length) {
    lines.push("\nRoutes:");
    for (const r of routes) {
      const bits = [r.name, r.tier, r.distanceKm ? `${r.distanceKm} km` : null, r.elevationM ? `${r.elevationM} m elev` : null]
        .filter(Boolean)
        .join(" · ");
      lines.push(`- ${bits}`);
    }
  }

  const classes = Array.isArray(event.classes) ? event.classes : [];
  if (classes.length) lines.push(`\nClasses: ${classes.map((c: any) => c.name ?? c).join(", ")}`);

  if (info) {
    if (info.venue_address) lines.push(`\nVenue: ${info.venue_address}`);
    if (info.parking_notes) lines.push(`Parking: ${info.parking_notes}`);
    if (info.route_description) lines.push(`Route notes: ${info.route_description}`);
    if (info.distance_km) lines.push(`Distance: ${info.distance_km} km`);
    if (info.elevation_m) lines.push(`Elevation: ${info.elevation_m} m`);
    if (info.rules_md) lines.push(`\nRules:\n${info.rules_md}`);
    if (Array.isArray(info.faqs) && info.faqs.length) {
      lines.push("\nFAQs:");
      for (const f of info.faqs) lines.push(`Q: ${f.q}\nA: ${f.a}`);
    }
    if (Array.isArray(info.packing_list) && info.packing_list.length) {
      lines.push(`\nPacking list: ${info.packing_list.map((p: any) => p.label).join(", ")}`);
    }
    if (Array.isArray(info.emergency_contacts) && info.emergency_contacts.length) {
      lines.push(
        `\nEmergency contacts: ${info.emergency_contacts.map((c: any) => `${c.label}: ${c.phone}`).join("; ")}`,
      );
    }
  }

  return lines.join("\n");
}

// ---------- main server fn ----------

export const askEventBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", data.eventId)
      .maybeSingle();
    if (eventErr) throw new Error(eventErr.message);
    if (!event) throw new Error("Event not found");

    const { data: info } = await supabase
      .from("event_info_blocks")
      .select("*")
      .eq("event_id", data.eventId)
      .maybeSingle();

    // Ensure Q&A thread exists.
    let threadId: string | null = null;
    const { data: existing } = await supabase
      .from("admin_qa_threads")
      .select("id")
      .eq("event_id", data.eventId)
      .eq("rider_user_id", userId)
      .maybeSingle();
    if (existing?.id) {
      threadId = existing.id as string;
    } else {
      const { data: created, error: createErr } = await supabase
        .from("admin_qa_threads")
        .insert({ event_id: data.eventId, rider_user_id: userId })
        .select("id")
        .single();
      if (createErr) throw new Error(createErr.message);
      threadId = created.id as string;
    }

    // Log rider question.
    const { error: qErr } = await supabase.from("admin_qa_messages").insert({
      thread_id: threadId,
      author_id: userId,
      body: data.question,
      is_admin_msg: false,
      is_bot: false,
    });
    if (qErr) throw new Error(qErr.message);

    await supabase
      .from("admin_qa_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);

    // Recent conversation for follow-up context.
    const { data: recent } = await supabase
      .from("admin_qa_messages")
      .select("body, is_admin_msg, is_bot, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(8);
    const history = (recent ?? []).reverse();

    // Structured event data.
    const structured = formatEventStructured(event, info);

    // Crawl website + FAQ (BFS, cached).
    const seeds = [event.website_url, event.faq_url].filter(Boolean) as string[];
    const pages = seeds.length ? await crawlSite(seeds, 8) : [];

    // Budget the scraped text (~28k chars total).
    const PER_PAGE_CAP = 6000;
    const TOTAL_CAP = 28000;
    let used = 0;
    const scrapedParts: string[] = [];
    for (const p of pages) {
      if (used >= TOTAL_CAP) break;
      const remaining = TOTAL_CAP - used;
      const slice = p.text.slice(0, Math.min(PER_PAGE_CAP, remaining));
      scrapedParts.push(`SOURCE: ${p.url}\n${slice}`);
      used += slice.length;
    }

    const context_text = [
      "STRUCTURED EVENT DATA (authoritative):",
      structured,
      scrapedParts.length ? "\n\nWEBSITE PAGES:" : "",
      ...scrapedParts,
    ]
      .filter(Boolean)
      .join("\n\n---\n\n");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const systemPrompt = `You are the Red Cherry Events rider assistant for "${event.name}".

Answer rider questions using the CONTEXT provided (structured event data + scraped official website pages). Be helpful, concise, specific, and friendly. Use 2–5 sentences or a short bulleted list when appropriate.

Rules:
- Prefer STRUCTURED EVENT DATA when it directly answers the question (dates, schedule, routes, venue, rules, FAQs, emergency contacts, packing).
- Otherwise pull the answer from the WEBSITE PAGES. Synthesise across pages if needed — an answer that requires combining two sources is fine.
- If the exact detail isn't stated but can be reasonably inferred from the sources (e.g. "the event starts 7 March 2026" from a schedule page), give the answer and note briefly where it comes from.
- Do NOT invent prices, times, dates, cut-offs or policies that are not in the context.
- Only if the context genuinely has nothing relevant, reply with exactly this token and nothing else: ${BOT_MISS_SENTINEL}
- Never mention the sentinel, "CONTEXT", "sources", or that you scraped a website in your visible answer.`;

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "system", content: `CONTEXT:\n${context_text || "(no additional context available)"}` },
    ];

    for (const m of history.slice(0, -1)) {
      // history includes the question we just inserted at the end; skip it.
      if (m.is_admin_msg || m.is_bot) {
        messages.push({ role: "assistant", content: m.body });
      } else {
        messages.push({ role: "user", content: m.body });
      }
    }
    messages.push({ role: "user", content: data.question });

    let botAnswer = BOT_MISS_SENTINEL;
    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-5.5",
          messages,
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (aiRes.ok) {
        const j = (await aiRes.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = j.choices?.[0]?.message?.content?.trim() ?? "";
        if (raw) botAnswer = raw;
      } else {
        console.error("AI gateway error", aiRes.status, await aiRes.text().catch(() => ""));
      }
    } catch (e) {
      console.error("AI gateway call failed", e);
    }

    const needsAdmin = botAnswer.trim().toUpperCase() === BOT_MISS_SENTINEL;
    const botBody = needsAdmin
      ? "I couldn't find a confident answer for that in the event details or website — I've flagged this for a Red Cherry admin to reply personally. 🍒"
      : botAnswer;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: botErr } = await supabaseAdmin.from("admin_qa_messages").insert({
      thread_id: threadId,
      author_id: null,
      body: botBody,
      is_admin_msg: false,
      is_bot: true,
    });
    if (botErr) throw new Error(botErr.message);

    await supabaseAdmin
      .from("admin_qa_threads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", threadId);

    return { threadId, needsAdmin, answer: botBody };
  });
