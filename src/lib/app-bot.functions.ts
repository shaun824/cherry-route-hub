import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { BOT_MISS_REPLY } from "@/lib/bot-handoff";

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

    const { text: contextText, focusEventIds } = await buildGlobalBotContext(supabaseAdmin as any, {
      question: data.question,
      userId,
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
- When useful, point them at the right place in the app (e.g. "Adventure Awaits → your event → Village map").
- Only if the context genuinely has nothing relevant, reply with exactly this token and nothing else: ${BOT_MISS_SENTINEL}
- Never mention the sentinel, "context", or that information was scraped.`;

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
        if (res.status === 429) return { answer: "I'm getting a lot of questions right now — try again in a moment.", needsAdmin: false };
        if (res.status === 402)
          return { answer: "The assistant is temporarily unavailable. Please use 'Report a problem' below.", needsAdmin: true };
      }
    } catch (e) {
      console.error("[app-bot] gateway call failed", e);
    }

    const needsAdmin = answer.trim().toUpperCase() === BOT_MISS_SENTINEL;
    const body = needsAdmin ? BOT_MISS_REPLY : answer;

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

    return { answer: body, needsAdmin };
  });
