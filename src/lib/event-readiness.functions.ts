// Admin-only: event ops readiness checklist + unanswered crew questions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { READINESS_QUESTIONS, readinessRef } from "@/lib/event-readiness";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .limit(1);
  if (!data?.length) throw new Error("Forbidden");
}

export const getEventReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ eventId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: notes } = await supabaseAdmin
      .from("business_knowledge")
      .select("id, title, body, source_ref, updated_at")
      .eq("event_id", data.eventId)
      .eq("status", "approved")
      .like("source_ref", "readiness:%");
    const answers: Record<string, { id: string; title: string; body: string; updatedAt: string }> = {};
    for (const n of notes ?? []) {
      const qid = String(n.source_ref).slice("readiness:".length);
      answers[qid] = { id: n.id, title: n.title, body: n.body, updatedAt: n.updated_at };
    }

    // Crew/admin questions the bot couldn't answer for this event.
    const { data: staff } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "crew"]);
    const staffIds = Array.from(new Set((staff ?? []).map((s: any) => s.user_id as string)));
    const gaps: { id: string; question: string; at: string }[] = [];
    if (staffIds.length) {
      const { data: threads } = await supabaseAdmin
        .from("admin_qa_threads")
        .select("id")
        .eq("event_id", data.eventId)
        .in("rider_user_id", staffIds);
      const threadIds = (threads ?? []).map((t: any) => t.id as string);
      if (threadIds.length) {
        const { data: msgs } = await supabaseAdmin
          .from("admin_qa_messages")
          .select("id, thread_id, body, is_bot, is_admin_msg, created_at")
          .in("thread_id", threadIds)
          .order("created_at", { ascending: true })
          .limit(2000);
        const list = (msgs ?? []) as any[];
        for (let i = 1; i < list.length; i++) {
          const m = list[i];
          if (!m.is_bot || !String(m.body).includes("couldn't find a confident answer")) continue;
          const q = list[i - 1];
          if (q && !q.is_bot && q.thread_id === m.thread_id) {
            gaps.push({ id: q.id, question: q.body, at: q.created_at });
          }
        }
      }
    }
    const { data: dismissed } = await supabaseAdmin
      .from("business_knowledge")
      .select("source_ref")
      .eq("event_id", data.eventId)
      .like("source_ref", "crewgap:%");
    const handled = new Set((dismissed ?? []).map((d: any) => String(d.source_ref).slice(8)));
    const seen = new Set<string>();
    const openGaps = gaps
      .reverse()
      .filter((g) => {
        const k = g.question.trim().toLowerCase();
        if (handled.has(g.id) || seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 50);

    return {
      answers,
      total: READINESS_QUESTIONS.length,
      answered: READINESS_QUESTIONS.filter((q) => answers[q.id]).length,
      gaps: openGaps,
    };
  });

const AnswerInput = z.object({
  eventId: z.string().uuid(),
  questionId: z.string().max(60).nullable().default(null),
  gapMessageId: z.string().uuid().nullable().default(null),
  question: z.string().trim().min(3).max(600),
  message: z.string().trim().max(6000).default(""),
  audio: z
    .object({ mimeType: z.string().max(120), dataBase64: z.string().min(16).max(12_000_000) })
    .nullable()
    .default(null),
});

export const answerReadinessQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AnswerInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { extractAttachmentText, draftTeachNote } = await import("@/lib/knowledge-teach.server");
    let spoken = "";
    if (data.audio) {
      spoken = await extractAttachmentText({
        kind: "audio",
        mimeType: data.audio.mimeType,
        dataBase64: data.audio.dataBase64,
        filename: null,
      } as any);
    }
    const answer = [data.message, spoken].filter((s) => s.trim()).join("\n");
    if (answer.trim().length < 3) throw new Error("Type or record an answer first.");

    const ref = data.questionId
      ? readinessRef(data.questionId)
      : data.gapMessageId
        ? `crewgap:${data.gapMessageId}`
        : null;

    let existing: { id: string; title: string; body: string } | null = null;
    if (data.questionId) {
      const { data: row } = await context.supabase
        .from("business_knowledge")
        .select("id, title, body")
        .eq("event_id", data.eventId)
        .eq("source_ref", ref)
        .maybeSingle();
      if (row) existing = row as any;
    }

    const { draft, redactions } = await draftTeachNote({
      message: `CREW QUESTION: ${data.question}\nADMIN ANSWER: ${answer}`,
      existing: existing ? { title: existing.title, body: existing.body } : null,
    });

    const now = new Date().toISOString();
    const row = {
      title: draft.title,
      body: draft.body,
      summary: draft.summary,
      category: "ops",
      tier: "internal",
      status: "approved",
      event_id: data.eventId,
      source_ref: ref,
      redaction_notes: redactions,
      approved_by: context.userId,
      approved_at: now,
    };
    if (existing) {
      const { error } = await context.supabase.from("business_knowledge").update(row).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("business_knowledge")
        .insert({ ...row, source_kind: "chat", created_by: context.userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true, title: draft.title, body: draft.body, transcript: spoken || null };
  });
