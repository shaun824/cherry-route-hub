// Server-only: turns real rider questions + admin answers into draft FAQ entries
// for the learned knowledge base, and reports questions the bot could not answer.
import type { SupabaseClient } from "@supabase/supabase-js";

const BOT_MISS_MARKER = "couldn't find a confident answer";

type Msg = {
  id: string;
  thread_id: string;
  body: string;
  is_admin_msg: boolean;
  is_bot: boolean;
  created_at: string;
};

type Pair = { threadId: string; eventId: string | null; question: string; answer: string; messageId: string };

/** Finds rider question → admin answer pairs that haven't been drafted yet. */
async function findPairs(admin: SupabaseClient<any, any, any>, sinceDays = 14): Promise<Pair[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: messages, error } = await admin
    .from("admin_qa_messages")
    .select("id, thread_id, body, is_admin_msg, is_bot, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw new Error(error.message);

  const rows = (messages ?? []) as Msg[];
  if (rows.length === 0) return [];

  const threadIds = Array.from(new Set(rows.map((m) => m.thread_id)));
  const { data: threads } = await admin
    .from("admin_qa_threads")
    .select("id, event_id")
    .in("id", threadIds);
  const eventByThread = new Map<string, string | null>(
    (threads ?? []).map((t: any) => [t.id as string, (t.event_id as string) ?? null]),
  );

  // Skip messages already turned into a draft.
  const { data: existing } = await admin
    .from("event_faq_learned")
    .select("source_message_id")
    .not("source_message_id", "is", null)
    .limit(2000);
  const done = new Set((existing ?? []).map((r: any) => r.source_message_id as string));

  const byThread = new Map<string, Msg[]>();
  for (const m of rows) {
    const list = byThread.get(m.thread_id) ?? [];
    list.push(m);
    byThread.set(m.thread_id, list);
  }

  const pairs: Pair[] = [];
  for (const [threadId, list] of byThread) {
    for (let i = 1; i < list.length; i++) {
      const answer = list[i];
      if (!answer.is_admin_msg || answer.is_bot) continue;
      if (done.has(answer.id)) continue;
      // Nearest preceding rider question.
      let question: Msg | null = null;
      for (let j = i - 1; j >= 0; j--) {
        const cand = list[j];
        if (!cand.is_admin_msg && !cand.is_bot) {
          question = cand;
          break;
        }
      }
      if (!question) continue;
      if (question.body.trim().length < 8 || answer.body.trim().length < 8) continue;
      pairs.push({
        threadId,
        eventId: eventByThread.get(threadId) ?? null,
        question: question.body.trim(),
        answer: answer.body.trim(),
        messageId: answer.id,
      });
    }
  }
  return pairs.slice(0, 40);
}

type Draft = { question: string; answer: string; reusable: boolean; scope: "event" | "global" };

async function draftPair(pair: Pair): Promise<Draft | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;

  const system = `You clean up support conversations into reusable FAQ entries for a cycling/motorsport event organiser (Red Cherry Events).

Given one rider question and the admin's answer, respond with JSON only:
{"reusable": boolean, "scope": "event"|"global", "question": string, "answer": string}

Rules:
- reusable=false if the exchange is personal or one-off (a specific rider's tent number, registration, refund, medical issue, name, phone number, or anything only true for that person).
- reusable=false if the answer is vague, incomplete, or just chit-chat ("thanks", "will check", "see you there").
- scope="global" only if the answer is true for every Red Cherry event; otherwise "event".
- Rewrite the question as a short neutral question a future rider would ask.
- Rewrite the answer as 1-3 clear sentences, no greetings, no names, no personal data.
- Never invent facts that are not in the admin's answer.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "openai/gpt-5.5",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `RIDER: ${pair.question}\n\nADMIN: ${pair.answer}` },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      console.error("[faq-suggest] AI error", res.status, await res.text().catch(() => ""));
      return null;
    }
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = j.choices?.[0]?.message?.content?.trim() ?? "";
    const jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(jsonText) as Draft;
    if (!parsed || typeof parsed.question !== "string" || typeof parsed.answer !== "string") return null;
    return parsed;
  } catch (e) {
    console.error("[faq-suggest] draft failed", e);
    return null;
  }
}

export async function suggestLearnedFaqs(admin: SupabaseClient<any, any, any>) {
  const pairs = await findPairs(admin);
  let created = 0;
  let skipped = 0;

  for (const pair of pairs) {
    const draft = await draftPair(pair);
    if (!draft || !draft.reusable) {
      skipped++;
      continue;
    }
    const { error } = await admin.from("event_faq_learned").insert({
      event_id: draft.scope === "global" ? null : pair.eventId,
      question: draft.question.slice(0, 500),
      answer: draft.answer.slice(0, 4000),
      status: "suggested",
      source_thread_id: pair.threadId,
      source_message_id: pair.messageId,
    });
    if (error) {
      console.error("[faq-suggest] insert failed", error);
      skipped++;
      continue;
    }
    created++;
  }

  return { scanned: pairs.length, created, skipped };
}

/** Questions where the bot gave up — the gap report. */
export async function collectBotGaps(admin: SupabaseClient<any, any, any>) {
  const { data: misses } = await admin
    .from("admin_qa_messages")
    .select("id, thread_id, body, created_at")
    .eq("is_bot", true)
    .ilike("body", `%${BOT_MISS_MARKER}%`)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (misses ?? []) as { id: string; thread_id: string; created_at: string }[];
  if (rows.length === 0) return { items: [] as { question: string; threadId: string; at: string }[] };

  const threadIds = Array.from(new Set(rows.map((m) => m.thread_id)));
  const { data: questions } = await admin
    .from("admin_qa_messages")
    .select("thread_id, body, created_at, is_admin_msg, is_bot")
    .in("thread_id", threadIds)
    .eq("is_admin_msg", false)
    .eq("is_bot", false)
    .order("created_at", { ascending: true })
    .limit(1000);

  const qByThread = new Map<string, { body: string; created_at: string }[]>();
  for (const q of (questions ?? []) as any[]) {
    const list = qByThread.get(q.thread_id) ?? [];
    list.push({ body: q.body, created_at: q.created_at });
    qByThread.set(q.thread_id, list);
  }

  const items = rows
    .map((miss) => {
      const list = qByThread.get(miss.thread_id) ?? [];
      const before = list.filter((q) => q.created_at <= miss.created_at);
      const question = before.length ? before[before.length - 1].body : null;
      return question ? { question, threadId: miss.thread_id, at: miss.created_at } : null;
    })
    .filter(Boolean) as { question: string; threadId: string; at: string }[];

  return { items };
}
