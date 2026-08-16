// Server-only: learns from whole conversation ARCS, not just single replies.
//
// Where a conversation *ends* is usually what the rider actually wanted, so we
// read each thread top-to-bottom (rider, bot and admin turns) and distil it into
// one reusable question → resolving answer, plus the questions riders typically
// asked next in that same arc. Those follow-ups are handed back to the bots so
// future riders get the destination sooner.
import type { SupabaseClient } from "@supabase/supabase-js";
import { BOT_MISS_REPLY } from "@/lib/bot-handoff";

type Msg = {
  id: string;
  thread_id: string;
  body: string;
  is_admin_msg: boolean;
  is_bot: boolean;
  created_at: string;
};

type Arc = {
  threadId: string;
  eventId: string | null;
  lastMessageId: string;
  transcript: string;
  riderTurns: number;
};

type ArcDraft = {
  reusable: boolean;
  scope: "event" | "global";
  question: string;
  answer: string;
  followUps: string[];
};

const MISS_MARKER = BOT_MISS_REPLY.slice(0, 24).toLowerCase();

function speaker(m: Msg): string {
  if (m.is_bot) return "ASSISTANT";
  if (m.is_admin_msg) return "ADMIN";
  return "RIDER";
}

/** Recent threads that ran long enough to have an arc worth learning from. */
async function collectArcs(admin: SupabaseClient<any, any, any>, sinceDays: number): Promise<Arc[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: messages, error } = await admin
    .from("admin_qa_messages")
    .select("id, thread_id, body, is_admin_msg, is_bot, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) throw new Error(error.message);

  const rows = (messages ?? []) as Msg[];
  if (!rows.length) return [];

  const threadIds = Array.from(new Set(rows.map((m) => m.thread_id)));
  const { data: threads } = await admin
    .from("admin_qa_threads")
    .select("id, event_id")
    .in("id", threadIds);
  const eventByThread = new Map<string, string | null>(
    (threads ?? []).map((t: any) => [t.id as string, (t.event_id as string) ?? null]),
  );

  // Skip arcs already distilled (we key on the arc's last message).
  const { data: existing } = await admin
    .from("event_faq_learned")
    .select("source_message_id")
    .not("source_message_id", "is", null)
    .limit(4000);
  const done = new Set((existing ?? []).map((r: any) => r.source_message_id as string));

  const byThread = new Map<string, Msg[]>();
  for (const m of rows) {
    const list = byThread.get(m.thread_id) ?? [];
    list.push(m);
    byThread.set(m.thread_id, list);
  }

  const arcs: Arc[] = [];
  for (const [threadId, list] of byThread) {
    const last = list[list.length - 1];
    if (!last || done.has(last.id)) continue;

    const riderTurns = list.filter((m) => !m.is_bot && !m.is_admin_msg).length;
    // An arc needs at least a question and a reply, and is only interesting once
    // the rider pushed further or a human stepped in.
    if (list.length < 3 || riderTurns < 2) continue;

    // Threads that ended on a hand-off never reached an answer — those are the
    // gap report's job, not the knowledge base's.
    if (last.is_bot && last.body.toLowerCase().includes(MISS_MARKER)) continue;
    // The arc has to actually end on an answer.
    if (!last.is_bot && !last.is_admin_msg) continue;

    const transcript = list
      .slice(-14)
      .map((m) => `${speaker(m)}: ${m.body.trim().slice(0, 1200)}`)
      .join("\n\n");

    arcs.push({
      threadId,
      eventId: eventByThread.get(threadId) ?? null,
      lastMessageId: last.id,
      transcript,
      riderTurns,
    });
  }

  return arcs.slice(0, 25);
}

async function draftArc(arc: Arc): Promise<ArcDraft | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;

  const system = `You study support conversations for a cycling / motorsport event organiser (Red Cherry Events) and turn each one into a single reusable FAQ entry.

You are given a whole conversation arc. The END of the arc is the important part: it is usually what the person was really after all along, even when their first message asked something narrower or vaguer.

Respond with JSON only:
{"reusable": boolean, "scope": "event"|"global", "question": string, "answer": string, "followUps": string[]}

Rules:
- Work out the rider's REAL underlying need from the whole arc, then write "question" as the short neutral question a future rider would ask to get straight to it.
- "answer" is the resolving information the arc landed on, rewritten as 1-4 clear sentences. Include the concrete facts (times, places, links, steps) that actually resolved it.
- "followUps": 0-3 short questions, in the rider's own voice, that this arc shows people ask next. Empty array if the arc shows none.
- reusable=false when the arc is personal or one-off (one rider's tent number, race number, refund, medical issue, name, contact details), when it never reached a real answer, or when it is just chit-chat.
- scope="global" only when the answer is true for every Red Cherry event; otherwise "event".
- Never invent facts that are not in the conversation. No names, no personal data, no greetings.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "openai/gpt-5.5",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `CONVERSATION ARC:\n\n${arc.transcript}` },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      console.error("[faq-arcs] AI error", res.status, await res.text().catch(() => ""));
      return null;
    }
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = j.choices?.[0]?.message?.content?.trim() ?? "";
    const jsonText = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(jsonText) as ArcDraft;
    if (!parsed || typeof parsed.question !== "string" || typeof parsed.answer !== "string") return null;
    return {
      ...parsed,
      followUps: Array.isArray(parsed.followUps)
        ? parsed.followUps.filter((f) => typeof f === "string" && f.trim().length > 4).slice(0, 3)
        : [],
    };
  } catch (e) {
    console.error("[faq-arcs] draft failed", e);
    return null;
  }
}

/** Distils recent conversation arcs into draft FAQ entries awaiting admin approval. */
export async function learnFromArcs(admin: SupabaseClient<any, any, any>, sinceDays = 30) {
  const arcs = await collectArcs(admin, sinceDays);
  let created = 0;
  let skipped = 0;

  for (const arc of arcs) {
    const draft = await draftArc(arc);
    if (!draft || !draft.reusable) {
      skipped++;
      continue;
    }
    const { error } = await admin.from("event_faq_learned").insert({
      event_id: draft.scope === "global" ? null : arc.eventId,
      question: draft.question.slice(0, 500),
      answer: draft.answer.slice(0, 4000),
      follow_ups: draft.followUps.map((f) => f.slice(0, 160)),
      status: "suggested",
      source_kind: "arc",
      source_thread_id: arc.threadId,
      source_message_id: arc.lastMessageId,
    });
    if (error) {
      console.error("[faq-arcs] insert failed", error);
      skipped++;
      continue;
    }
    created++;
  }

  return { arcs: arcs.length, created, skipped };
}
