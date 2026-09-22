// Admin-only "teach the assistant by chatting to it" server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .limit(1);
  if (!data?.length) throw new Error("Forbidden");
}

const Attachment = z.object({
  kind: z.enum(["image", "audio", "pdf"]),
  mimeType: z.string().trim().max(120),
  dataBase64: z.string().min(16).max(12_000_000),
  filename: z.string().trim().max(200).nullable().default(null),
});

const TeachInput = z.object({
  message: z.string().trim().max(6000).default(""),
  attachment: Attachment.nullable().default(null),
  /** When refining, the note this conversation is already working on. */
  noteId: z.string().uuid().nullable().default(null),
});

/** Read the message/attachment, draft a note, return it WITHOUT saving. */
export const teachAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TeachInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    if (!data.message.trim() && !data.attachment) {
      throw new Error("Send me something to learn — a message, a picture, a voice note or a document.");
    }

    const { extractAttachmentText, draftTeachNote } = await import("@/lib/knowledge-teach.server");

    let extracted: string | null = null;
    if (data.attachment) {
      extracted = await extractAttachmentText(data.attachment as any);
      if (!extracted.trim()) {
        throw new Error("I couldn't get anything out of that attachment — try another one.");
      }
    }

    let existing: { title: string; body: string } | null = null;
    if (data.noteId) {
      const { data: row } = await context.supabase
        .from("business_knowledge")
        .select("title, body")
        .eq("id", data.noteId)
        .maybeSingle();
      if (row) existing = { title: row.title as string, body: row.body as string };
    }

    const { draft, redactions } = await draftTeachNote({
      message: data.message,
      extracted,
      existing,
    });

    return { draft, redactions, extracted, noteId: data.noteId };
  });

const SaveInput = z.object({
  noteId: z.string().uuid().nullable().default(null),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(8000),
  summary: z.string().trim().max(500).nullable().default(null),
  category: z.enum(["ops", "product", "suppliers", "policies", "general"]).default("general"),
  tier: z.enum(["public", "internal"]).default("public"),
  eventId: z.string().uuid().nullable().default(null),
});

/** Save the confirmed draft. Live immediately — the admin already approved it. */
export const saveTaughtNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { cleanForKnowledge } = await import("@/lib/knowledge-redact");
    const safeBody = cleanForKnowledge(data.body);
    const now = new Date().toISOString();

    const row = {
      title: data.title,
      body: safeBody.text,
      summary: data.summary,
      category: data.category,
      tier: data.tier,
      status: "approved" as const,
      event_id: data.eventId,
      redaction_notes: safeBody.notes,
      approved_by: context.userId,
      approved_at: now,
    };

    if (data.noteId) {
      const { error } = await context.supabase
        .from("business_knowledge")
        .update(row)
        .eq("id", data.noteId);
      if (error) throw new Error(error.message);
      return { id: data.noteId, updated: true, redactions: safeBody.notes };
    }

    const { data: created, error } = await context.supabase
      .from("business_knowledge")
      .insert({ ...row, source_kind: "chat", created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string, updated: false, redactions: safeBody.notes };
  });
