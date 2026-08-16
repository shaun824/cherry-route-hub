import { createServerFn } from "@tanstack/react-start";
import { BOT_MISS_REPLY } from "@/lib/bot-handoff";
import { FOLLOWUP_PROMPT_RULE, splitFollowUps } from "@/lib/bot-followups";
import { venueMapLinks } from "@/lib/map-embed";

import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BOT_MISS_SENTINEL = "NEEDS_ADMIN";

const AskInput = z.object({
  eventId: z.string().uuid(),
  question: z.string().trim().min(1).max(1000),
});

// Crawling + the daily-refreshed knowledge base live in event-bot-crawl.server.ts
// (loaded inside the handler so it never reaches the client bundle).



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
    const maps = venueMapLinks({
      mapUrl: info.venue_map_url ?? info.map_url ?? null,
      lat: info.venue_lat != null ? Number(info.venue_lat) : null,
      lng: info.venue_lng != null ? Number(info.venue_lng) : null,
      address: info.venue_address ?? event.location ?? null,
      name: event.location ?? null,
    });
    if (maps) {
      lines.push(
        `These Google Maps links point at the confirmed venue (${event.location ?? info.venue_address}) — use them exactly as given, never build your own.`,
      );
      lines.push(`Venue on Google Maps: ${maps.pin}`);
      lines.push(`Driving directions to the venue: ${maps.directions}`);
    }

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

function formatMerchCatalogue(rows: any[]): string {
  if (!rows.length) return "";
  const lines: string[] = [
    "EXTRAS / ADD-ONS AVAILABLE ON THE ENTRY FORM (live from Entry Ninja — authoritative for what riders can buy for THIS event):",
  ];
  for (const r of rows) {
    const bits = [r.name];
    if (r.price_from) bits.push(`from R${Number(r.price_from).toFixed(0)}`);
    lines.push(`- ${bits.join(" — ")}`);
    if (r.description) lines.push(`  ${r.description}`);
    const opts = Array.isArray(r.options) ? r.options : [];
    for (const o of opts) {
      const label = o?.name ?? o?.label ?? String(o);
      lines.push(`  · ${label}${o?.price ? ` (R${Number(o.price).toFixed(0)})` : ""}`);
    }
    if (r.source_url) lines.push(`  More info: ${r.source_url}`);
  }
  lines.push(
    "If an add-on is listed above, it IS offered for this event — say so and describe the options. If a rider asks about an add-on that is NOT listed, say it isn't available on this event's entry form (it may be offered on other Red Cherry events or in a future year) rather than denying it exists.",
  );
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

    // Entry Ninja extras / merchandise catalogue for this event (No Hassle
    // Package, jackets, dietary options, single rooms, ...).
    const { data: merch } = await supabase
      .from("event_merch_options")
      .select("name, description, price_from, options, source_url")
      .eq("event_id", data.eventId)
      .order("position", { ascending: true });



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
    const structured = [
      formatEventStructured(event, info),
      formatMerchCatalogue(merch ?? []),
    ]
      .filter(Boolean)
      .join("\n\n");


    // Website knowledge base (crawled and cached, auto-refreshed daily).
    const { supabaseAdmin: adminForKb } = await import("@/integrations/supabase/client.server");
    const { getEventKnowledge } = await import("@/lib/event-bot-crawl.server");
    const scraped = await getEventKnowledge(adminForKb, event as any);

    // Admin-approved answers learned from real rider conversations.
    const today = new Date().toISOString().slice(0, 10);
    const { data: learned } = await adminForKb
      .from("event_faq_learned")
      .select("id, question, answer, expires_on, event_id, follow_ups")
      .eq("status", "approved")
      .or(`event_id.eq.${data.eventId},event_id.is.null`)
      .limit(100);
    const approved = (learned ?? []).filter(
      (f: any) => !f.expires_on || String(f.expires_on) >= today,
    );
    const approvedText = approved
      .map((f: any) => {
        const next = ((f.follow_ups ?? []) as string[]).filter(Boolean);
        return `Q: ${f.question}\nA: ${f.answer}${
          next.length ? `\nRiders who asked this usually asked next: ${next.join(" | ")}` : ""
        }`;
      })
      .join("\n\n");


    // The signed-in rider's own system data: profile, Entry Ninja entry,
    // accommodation / tent allocation and village-map pin.
    let riderText = "";
    try {
      const { buildRiderContext } = await import("@/lib/event-bot-rider.server");
      riderText = await buildRiderContext(adminForKb as any, userId, data.eventId);
    } catch (e) {
      console.error("rider context failed", e);
    }

    const context_text = [
      approvedText ? "APPROVED ANSWERS (highest priority — verified by Red Cherry admins):" : "",
      approvedText,
      riderText ? "THIS RIDER'S OWN RECORDS (from our system — authoritative, personal to them):" : "",
      riderText,
      "STRUCTURED EVENT DATA (authoritative):",
      structured,
      scraped ? "\n\nWEBSITE PAGES:" : "",
      scraped,
    ]
      .filter(Boolean)
      .join("\n\n---\n\n");



    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const systemPrompt = `You are the Red Cherry Events rider assistant for "${event.name}".

Answer rider questions using the CONTEXT provided (this rider's own records, structured event data, and official website pages). Be helpful, concise, specific, and friendly. Use 2–5 sentences or a short bulleted list when appropriate.

Rules:
- Personal questions ("what tent am I in?", "what's my race number?", "do I still owe anything?", "what category am I in?", "where do I sleep?") must be answered from THIS RIDER'S OWN RECORDS. That block is the truth for anything personal — never fall back to the website for it, and never tell them to contact the organisers when the answer is already in that block.
- When you give a tent or room allocation, also tell them they can tap "Show me on the village map" on the event page to navigate to it.
- If an APPROVED ANSWER matches the question, use it — it was verified by a Red Cherry admin and beats every other source.
- Otherwise prefer STRUCTURED EVENT DATA when it directly answers the question (dates, schedule, routes, venue, rules, FAQs, emergency contacts, packing).
- Otherwise pull the answer from the WEBSITE PAGES. Synthesise across pages if needed — an answer that requires combining two sources is fine.
- If the exact detail isn't stated but can be reasonably inferred from the sources (e.g. "the event starts 7 March 2026" from a schedule page), give the answer and note briefly where it comes from.
- Do NOT invent prices, times, dates, cut-offs, race numbers, tent numbers or policies that are not in the context.
- Think the question through properly before answering: work out what the rider actually wants, scan EVERY block of context (rider records, structured data, extras/add-ons catalogue, approved answers, website pages) for anything related — including wording that differs from theirs (e.g. "bike transport" = "No Hassle Package", "hassle-free", "back-up vehicle") — and reason across sources to build the best answer you can.
- Never contradict or deny something unless the context clearly says it isn't offered. If you're unsure whether something exists, say what the context DOES show and offer to check with the team, rather than telling the rider it doesn't exist.
- Always try hard to answer first, combining anything relevant in the context, and give a partial answer with what you DO know rather than handing off. Never suggest WhatsApp or contacting the team in an answer you were able to give.
- Only if the context genuinely has nothing relevant, reply with exactly this token and nothing else: ${BOT_MISS_SENTINEL} (the app then logs it for a Red Cherry admin and offers the rider our WhatsApp business chat — so never write your own "contact us" message).
- Directions, parking and "where is it?" questions: always include the Google Maps links from the context as markdown links, e.g. [Open in Google Maps](…) and [Get directions](…). Add them whenever the venue, parking, arrival or travel comes up, even in passing.
- Give the rider somewhere to read more: when your answer comes from a website page or an extra/add-on with a "More info" or SOURCE url, finish that point with a markdown link, e.g. [Read more on the event website](https://…). Use only urls that appear in the context — never invent or guess a link — and keep it to one or two links per answer.
${FOLLOWUP_PROMPT_RULE}
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

    const needsAdmin = splitFollowUps(botAnswer).body.trim().toUpperCase() === BOT_MISS_SENTINEL;
    const botBody = needsAdmin ? BOT_MISS_REPLY : botAnswer;

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
