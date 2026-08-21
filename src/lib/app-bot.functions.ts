import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { BOT_MISS_REPLY } from "@/lib/bot-handoff";
import { FOLLOWUP_PROMPT_RULE, splitFollowUps } from "@/lib/bot-followups";
import { CONFIDENTIALITY_RULES } from "@/lib/knowledge-redact";


const BOT_MISS_SENTINEL = "NEEDS_ADMIN";

const AskInput = z.object({
  question: z.string().trim().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .max(16)
    .default([]),
  sessionId: z.string().trim().max(100).optional(),
});

/**
 * Global "Ask Red Cherry" assistant. Public: works signed out, and adds the
 * caller's own entry / tent / balance records when a valid session is present.
 */
export const askAppBot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildGlobalBotContext, resolveOptionalUserId } = await import("@/lib/app-bot.server");

    const authHeader = getRequestHeader("authorization") ?? null;
    const userId = await resolveOptionalUserId(authHeader);

    // Internal-tier knowledge is only ever exposed to verified admins.
    let isAdmin = false;
    if (userId) {
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .limit(1);
      isAdmin = (roles?.length ?? 0) > 0;
    }

    const { text: contextText, focusEventIds } = await buildGlobalBotContext(supabaseAdmin as any, {
      question: data.question,
      userId,
      isAdmin,
    });

    const systemPrompt = `You are the Red Cherry Events assistant inside the Rider Hub app. You help riders, spectators and crew with (a) how to use the app and (b) questions about any Red Cherry event, current or future.

Be friendly, concise and specific — 2 to 5 sentences, or a short bulleted list. Markdown is supported.

Rules:
- "How do I…" questions about the app are answered from HOW THE APP WORKS.
- Personal questions ("what tent am I in?", "what's my race number?", "do I owe anything?") must be answered from THIS PERSON'S OWN RECORDS. ${
      userId
        ? "That block is the truth for anything personal — never send them elsewhere when the answer is there."
        : "The person is NOT signed in, so no personal records are available: tell them to sign in (and link their entry with their ID number and surname under Adventure Awaits) to see their own entry, tent or balance."
    }
- If an APPROVED ANSWER matches, use it — it beats every other source.
- Otherwise use EVENT DETAIL and the event list, then WEBSITE PAGES. Combining sources is fine.
- Never invent prices, dates, times, cut-offs, race numbers, tent numbers or policies that are not in the context.
- ALWAYS make it one tap. Never give directions like "go to Adventure Awaits → your event" without also giving a markdown link. Every answer that refers to a place in the app, a website, an entry page or a WhatsApp number must end with (or contain) a tappable markdown link, e.g. "[Open your event hub](/my-events/EVENT_ID)".
- In-app links you can use: home [/], your events [/my-events], an event's rider hub [/my-events/EVENT_ID], public event page [/events/EVENT_ID], route map [/events/EVENT_ID/map], all events [/events], news [/feed], spectator info [/spectate] or [/spectate/EVENT_ID], promo codes [/promos], photos [/gallery], profile & notifications [/profile], sign in [/auth], crew login [/crew/login], crew dashboard [/crew], crew rooming [/crew/rooming]. Use the real event id from the context — never a placeholder or a guessed id.
- External links (Entry Ninja entry pages, event websites) must be full https URLs from the context, given as markdown links too.
- Think the question through before answering: work out what they actually want, scan every block of context for anything related (including different wording for the same thing, e.g. "bike transport" = "No Hassle Package"), and reason across sources to build the best answer you can.
- Never deny that something exists unless the context clearly says so — if unsure, share what the context DOES show and offer to check with the team.
- Always try hard to answer first. Piece the answer together from anything relevant in the context (event details, schedules, website pages, the person's own records, general app knowledge), and give partial answers with what you DO know rather than handing off. Handing the rider to a human or to WhatsApp is a genuine last resort.
- Never suggest WhatsApp, "contact the team" or "email us" in an answer you were able to give. Only escalate when the context truly contains nothing usable.
- Only if the context genuinely has nothing relevant, reply with exactly this token and nothing else: ${BOT_MISS_SENTINEL} (the app then offers our WhatsApp business chat — don't write your own contact message).
- Directions, parking and "where is it?" questions: always hand over the Google Maps links from the context as markdown links, e.g. [Open in Google Maps](…) and [Get directions](…). Include them any time the venue, parking, arrival or travel comes up.
- Give the rider somewhere to read more: when an answer comes from a website page or an extra/add-on that has a url in the context, end that point with a markdown link, e.g. [Read more on the event website](https://…). Only use urls that appear in the context — never invent one — and keep it to one or two links.
${FOLLOWUP_PROMPT_RULE}


- Never mention the sentinel, "context", or that information was scraped.

${CONFIDENTIALITY_RULES}`;



    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      { role: "system", content: `CONTEXT:\n${contextText}` },
      ...data.history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: data.question },
    ];

    let answer = BOT_MISS_SENTINEL;
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "google/gemini-3.6-flash", messages }),
      });
      if (res.ok) {
        const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = j.choices?.[0]?.message?.content?.trim() ?? "";
        if (raw) answer = raw;
      } else {
        console.error("[app-bot] gateway error", res.status, await res.text().catch(() => ""));
        if (res.status === 429) return { answer: "I'm getting a lot of questions right now — try again in a moment.", needsAdmin: false, followUps: [] as string[] };
        if (res.status === 402)
          return { answer: "The assistant is temporarily unavailable. Please use 'Report a problem' below.", needsAdmin: true, followUps: [] as string[] };

      }
    } catch (e) {
      console.error("[app-bot] gateway call failed", e);
    }

    const parsed = splitFollowUps(answer);
    const needsAdmin = parsed.body.trim().toUpperCase() === BOT_MISS_SENTINEL;
    const body = needsAdmin ? BOT_MISS_REPLY : parsed.body;
    const followUps = needsAdmin ? [] : parsed.followUps;


    // Log signed-in event questions into the existing admin Q&A threads so the
    // team sees them and can "Save as FAQ".
    if (userId && focusEventIds[0]) {
      try {
        const eventId = focusEventIds[0];
        const { data: existing } = await supabaseAdmin
          .from("admin_qa_threads")
          .select("id")
          .eq("event_id", eventId)
          .eq("rider_user_id", userId)
          .maybeSingle();
        let threadId = existing?.id as string | undefined;
        if (!threadId) {
          const { data: created } = await supabaseAdmin
            .from("admin_qa_threads")
            .insert({ event_id: eventId, rider_user_id: userId })
            .select("id")
            .single();
          threadId = created?.id as string | undefined;
        }
        if (threadId) {
          await supabaseAdmin.from("admin_qa_messages").insert([
            { thread_id: threadId, author_id: userId, body: data.question, is_admin_msg: false, is_bot: false },
            { thread_id: threadId, author_id: null, body, is_admin_msg: false, is_bot: true },
          ]);
          await supabaseAdmin
            .from("admin_qa_threads")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", threadId);
        }
      } catch (e) {
        console.error("[app-bot] logging failed", e);
      }
    }

    return { answer: body, needsAdmin, followUps };
  });
