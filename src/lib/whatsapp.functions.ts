import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ReplyInput = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
});

/**
 * Delivers an admin reply to a WhatsApp-channel thread over the Cloud API.
 * The message row itself is written by the admin inbox; this only sends.
 */
export const sendWhatsAppReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReplyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .limit(1);
    if (!roles?.length) throw new Error("Forbidden");

    const { data: thread, error } = await supabase
      .from("admin_qa_threads")
      .select("channel, wa_phone")
      .eq("id", data.threadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!thread) throw new Error("Thread not found");
    if (thread.channel !== "whatsapp" || !thread.wa_phone) {
      return { sent: false, reason: "not-whatsapp" as const };
    }

    const { whatsappConfigured, sendWhatsAppText } = await import("@/lib/whatsapp.server");
    if (!whatsappConfigured()) return { sent: false, reason: "not-configured" as const };

    await sendWhatsAppText(thread.wa_phone, data.body);
    return { sent: true, reason: null };
  });

/* ---------------- Admin: readiness, templates, broadcast ---------------- */

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .limit(1);
  if (!data?.length) throw new Error("Forbidden");
}

/** Which Meta credentials are in place — drives the admin readiness panel. */
export const getWhatsAppReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { whatsappReadiness } = await import("@/lib/whatsapp.server");
    const r = whatsappReadiness();
    return {
      ...r,
      ready: r.token && r.phoneNumberId,
      webhookUrl: "https://riderapp.redcherryevents.co.za/api/public/hooks/whatsapp",
    };
  });

const TemplateInput = z.object({
  id: z.string().uuid().optional().nullable(),
  name: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9_]+$/, "Meta template names are lowercase letters, numbers and underscores"),
  language: z.string().trim().min(2).max(10).default("en"),
  description: z.string().trim().max(300).optional().nullable(),
  bodyPreview: z.string().trim().max(1200).optional().nullable(),
  variableLabels: z.array(z.string().trim().max(60)).max(10).default([]),
  active: z.boolean().default(true),
});

export const saveWhatsAppTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TemplateInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = {
      name: data.name,
      language: data.language,
      description: data.description || null,
      body_preview: data.bodyPreview || null,
      variable_labels: data.variableLabels,
      variable_count: data.variableLabels.length,
      active: data.active,
      updated_at: new Date().toISOString(),
    };
    const q = data.id
      ? context.supabase.from("whatsapp_templates").update(row).eq("id", data.id)
      : context.supabase.from("whatsapp_templates").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWhatsAppTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("whatsapp_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWhatsAppTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase
      .from("whatsapp_templates")
      .select("id, name, language, description, body_preview, variable_labels, variable_count, active")
      .order("name", { ascending: true });
    return data ?? [];
  });

const AudienceInput = z.object({
  audience: z.enum(["all", "event", "batch"]),
  eventId: z.string().uuid().optional().nullable(),
  batch: z.string().trim().max(120).optional().nullable(),
});

/** How many riders in an audience actually have a usable WhatsApp number. */
export const previewWhatsAppAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AudienceInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadOptOuts, normalizePhone } = await import("@/lib/whatsapp.server");
    const admin: any = supabaseAdmin;

    let entrantIds: string[] = [];
    if (data.audience === "all") {
      const { data: rows } = await admin.from("entrants").select("phone").limit(5000);
      const phones = Array.from(
        new Set((rows ?? []).map((r: any) => normalizePhone(r.phone ?? "")).filter(Boolean)),
      ) as string[];
      const optedOut = await loadOptOuts(admin, phones);
      return { phones: phones.length, optedOut: optedOut.size, reachable: phones.length - optedOut.size };
    }

    if (!data.eventId) return { phones: 0, optedOut: 0, reachable: 0 };
    let q = admin.from("event_entrants").select("entrant_id").eq("event_id", data.eventId);
    if (data.audience === "batch" && data.batch) q = q.eq("batch", data.batch);
    const { data: rows } = await q;
    entrantIds = Array.from(new Set((rows ?? []).map((r: any) => r.entrant_id).filter(Boolean)));
    if (!entrantIds.length) return { phones: 0, optedOut: 0, reachable: 0 };

    const phones = new Set<string>();
    for (let i = 0; i < entrantIds.length; i += 500) {
      const { data: ents } = await admin
        .from("entrants")
        .select("phone")
        .in("id", entrantIds.slice(i, i + 500));
      for (const e of ents ?? []) {
        const p = normalizePhone(e.phone ?? "");
        if (p) phones.add(p);
      }
    }
    const list = Array.from(phones);
    const optedOut = await loadOptOuts(admin, list);
    return { phones: list.length, optedOut: optedOut.size, reachable: list.length - optedOut.size };
  });

const BroadcastInput = z.object({
  title: z.string().trim().min(2).max(80),
  body: z.string().trim().min(2).max(500),
  url: z.string().trim().max(300).optional().or(z.literal("")),
  audience: z.enum(["all", "event", "batch"]),
  eventId: z.string().uuid().optional().nullable(),
  batch: z.string().trim().max(120).optional().nullable(),
  templateName: z.string().trim().max(120).optional().nullable(),
  templateLanguage: z.string().trim().max(10).optional().nullable(),
  templateVariables: z.array(z.string().trim().max(900)).max(10).default([]),
  alsoPush: z.boolean().default(false),
});

/** WhatsApp-first broadcast, optionally mirrored to push. */
export const sendWhatsAppBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BroadcastInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { dispatchNotification } = await import("@/lib/notifications.server");
    return dispatchNotification({
      title: data.title,
      body: data.body,
      url: data.url || "/",
      audience: data.audience,
      eventId: data.eventId ?? null,
      batch: data.batch ?? null,
      whatsapp: true,
      skipPush: !data.alsoPush,
      waTemplate: data.templateName
        ? {
            name: data.templateName,
            language: data.templateLanguage || "en",
            variables: data.templateVariables,
          }
        : null,
      source: "whatsapp",
      createdBy: context.userId,
    });
  });
