import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// RLS on event_faq_learned already restricts every operation to admins.

const ListInput = z.object({
  status: z.enum(["suggested", "approved", "rejected", "all"]).default("suggested"),
});

export const listLearnedFaqs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("event_faq_learned")
      .select(
        "id, event_id, question, answer, status, expires_on, times_used, created_at, source_thread_id, follow_ups, source_kind",
      )

      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

const UpsertInput = z.object({
  id: z.string().uuid().optional(),
  eventId: z.string().uuid().nullable().default(null),
  question: z.string().trim().min(3).max(500),
  answer: z.string().trim().min(1).max(4000),
  status: z.enum(["suggested", "approved", "rejected"]).default("approved"),
  expiresOn: z.string().nullable().optional(),
  sourceThreadId: z.string().uuid().nullable().optional(),
});

export const upsertLearnedFaq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpsertInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      event_id: data.eventId,
      question: data.question,
      answer: data.answer,
      status: data.status,
      expires_on: data.expiresOn || null,
      source_thread_id: data.sourceThreadId ?? null,
      created_by: userId,
      approved_by: data.status === "approved" ? userId : null,
      approved_at: data.status === "approved" ? new Date().toISOString() : null,
    };
    if (data.id) {
      const { error } = await supabase.from("event_faq_learned").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("event_faq_learned")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

const StatusInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["suggested", "approved", "rejected"]),
});

export const setLearnedFaqStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("event_faq_learned")
      .update({
        status: data.status,
        approved_by: data.status === "approved" ? userId : null,
        approved_at: data.status === "approved" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLearnedFaq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("event_faq_learned").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Runs the AI drafting pass on demand (same job the nightly cron runs). */
export const runFaqSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .limit(1);
    if (!roles?.length) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { suggestLearnedFaqs } = await import("@/lib/faq-suggest.server");
    return await suggestLearnedFaqs(supabaseAdmin);
  });

/** Questions the bot could not answer, most recent first — shows content gaps. */
export const listBotGaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .limit(1);
    if (!roles?.length) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { collectBotGaps } = await import("@/lib/faq-suggest.server");
    return await collectBotGaps(supabaseAdmin);
  });
