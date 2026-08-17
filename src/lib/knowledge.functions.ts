import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// RLS on business_knowledge / knowledge_intake already restricts every
// operation to admins; the extra role check guards the privileged paths.

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .limit(1);
  if (!data?.length) throw new Error("Forbidden");
}

const ListInput = z.object({
  status: z.enum(["suggested", "approved", "retired", "all"]).default("approved"),
  tier: z.enum(["public", "internal", "all"]).default("all"),
  category: z.enum(["ops", "product", "suppliers", "policies", "general", "all"]).default("all"),
});

export const listKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("business_knowledge")
      .select(
        "id, title, summary, body, category, tier, status, event_id, source_kind, source_ref, redaction_notes, times_used, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.tier !== "all") q = q.eq("tier", data.tier);
    if (data.category !== "all") q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

const PasteInput = z.object({
  text: z.string().trim().min(40).max(40000),
  eventId: z.string().uuid().nullable().default(null),
  tier: z.enum(["public", "internal"]).nullable().default(null),
  category: z
    .enum(["ops", "product", "suppliers", "policies", "general"])
    .nullable()
    .default(null),
  sourceRef: z.string().trim().max(300).nullable().default(null),
});

/** Paste an email / document / SOP; it is cleaned, redacted and drafted. */
export const pasteKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PasteInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ingestKnowledge } = await import("@/lib/knowledge-ingest.server");
    const result = await ingestKnowledge(supabaseAdmin as any, {
      text: data.text,
      sourceKind: "paste",
      sourceRef: data.sourceRef,
      eventId: data.eventId,
      tier: data.tier,
      category: data.category,
      createdBy: context.userId,
      status: "suggested",
    });
    return result;
  });

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(8000),
  summary: z.string().trim().max(500).nullable().default(null),
  category: z.enum(["ops", "product", "suppliers", "policies", "general"]).default("general"),
  tier: z.enum(["public", "internal"]).default("public"),
  status: z.enum(["suggested", "approved", "retired"]).default("approved"),
  eventId: z.string().uuid().nullable().default(null),
  reviewOn: z.string().nullable().optional(),
});

export const upsertKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertInput.parse(input))
  .handler(async ({ data, context }) => {
    const { cleanForKnowledge } = await import("@/lib/knowledge-redact");
    const safeBody = cleanForKnowledge(data.body);
    const row = {
      title: data.title,
      body: safeBody.text,
      summary: data.summary,
      category: data.category,
      tier: data.tier,
      status: data.status,
      event_id: data.eventId,
      review_on: data.reviewOn || null,
      redaction_notes: safeBody.notes,
      created_by: context.userId,
      approved_by: data.status === "approved" ? context.userId : null,
      approved_at: data.status === "approved" ? new Date().toISOString() : null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("business_knowledge")
        .update(row)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("business_knowledge")
      .insert({ ...row, source_kind: "paste" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const setKnowledgeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["suggested", "approved", "retired"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("business_knowledge")
      .update({
        status: data.status,
        approved_by: data.status === "approved" ? context.userId : null,
        approved_at: data.status === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setKnowledgeTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), tier: z.enum(["public", "internal"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("business_knowledge")
      .update({ tier: data.tier })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteKnowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("business_knowledge")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Recent forwarded emails and how they were handled. */
export const listKnowledgeIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("knowledge_intake")
      .select("id, from_address, subject, status, error, knowledge_id, received_at, processed_at")
      .order("received_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

/** Re-run the drafting pass on a forwarded email that failed or was skipped. */
export const retryKnowledgeIntake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ingestKnowledge } = await import("@/lib/knowledge-ingest.server");

    const { data: row, error } = await supabaseAdmin
      .from("knowledge_intake")
      .select("id, subject, raw_body")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Intake not found");

    const result = await ingestKnowledge(supabaseAdmin as any, {
      text: row.raw_body as string,
      sourceKind: "email",
      sourceRef: (row.subject as string) ?? null,
      createdBy: context.userId,
    });

    await supabaseAdmin
      .from("knowledge_intake")
      .update({
        status: result.ok ? "processed" : "skipped",
        error: result.ok ? null : result.reason,
        knowledge_id: result.ok ? result.id : null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    return result;
  });
