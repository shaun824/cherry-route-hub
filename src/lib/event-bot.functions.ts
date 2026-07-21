import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BOT_MISS_SENTINEL = "NEEDS_ADMIN";

const AskInput = z.object({
  eventId: z.string().uuid(),
  question: z.string().trim().min(1).max(1000),
});

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
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

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RedCherryEventsBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    return stripHtmlToText(html).slice(0, 12000);
  } catch {
    return "";
  }
}

export const askEventBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load event context (must be readable to this user under existing RLS).
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, name, description, event_date, location, website_url, faq_url")
      .eq("id", data.eventId)
      .maybeSingle();
    if (eventErr) throw new Error(eventErr.message);
    if (!event) throw new Error("Event not found");

    // Ensure a Q&A thread exists for this rider + event.
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

    // Log the rider's question first (author = rider, is_bot=false).
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

    // Gather source material for the bot: description + scraped website + FAQ.
    const sources: string[] = [];
    if (event.description) sources.push(`Event description:\n${event.description}`);
    if (event.event_date) sources.push(`Event date: ${new Date(event.event_date as string).toDateString()}`);
    if (event.location) sources.push(`Location: ${event.location}`);
    if (event.website_url) {
      const text = await fetchPageText(event.website_url as string);
      if (text) sources.push(`From official website (${event.website_url}):\n${text}`);
    }
    if (event.faq_url) {
      const text = await fetchPageText(event.faq_url as string);
      if (text) sources.push(`From FAQ page (${event.faq_url}):\n${text}`);
    }

    const context_text = sources.join("\n\n---\n\n");

    // Ask Lovable AI Gateway.
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const systemPrompt = `You are the Red Cherry Events assistant bot for the event "${event.name}".
Answer rider questions ONLY using the CONTEXT below. Be concise (2–4 sentences), friendly and specific.
If the answer is not clearly in the CONTEXT, or you are not confident, reply with exactly this token and nothing else: ${BOT_MISS_SENTINEL}
Never invent details, prices, times, or policies.`;

    const userPrompt = `CONTEXT:
${context_text || "(no additional context available)"}

QUESTION: ${data.question}`;

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
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (aiRes.ok) {
        const j = (await aiRes.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const raw = j.choices?.[0]?.message?.content?.trim() ?? "";
        if (raw) botAnswer = raw;
      }
    } catch {
      // fall through to NEEDS_ADMIN
    }

    const needsAdmin = botAnswer.trim().toUpperCase().includes(BOT_MISS_SENTINEL);
    const botBody = needsAdmin
      ? "I couldn't find a confident answer for that in the event details or website — I've flagged this for a Red Cherry admin to reply personally. 🍒"
      : botAnswer;

    // Insert bot reply via service role (RLS blocks is_bot=true for regular users).
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

    return {
      threadId,
      needsAdmin,
      answer: botBody,
    };
  });
