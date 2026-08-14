import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: rows } = await context.supabase.from("user_roles").select("role").eq("role", "admin").limit(1);
  if (!rows?.length) throw new Error("Forbidden");
}

const composeSchema = z.object({
  title: z.string().trim().min(2).max(80),
  body: z.string().trim().min(2).max(500),
  url: z.string().trim().max(300).optional().or(z.literal("")),
  imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  audience: z.enum(["all", "event", "batch"]),
  eventId: z.string().uuid().optional().nullable(),
  batch: z.string().trim().max(120).optional().nullable(),
  urgent: z.boolean().default(false),
  whatsapp: z.boolean().default(false),
  kind: z.enum(["news", "event_reminder", "safety", "general"]).optional(),
  source: z.string().trim().max(40).optional(),
});

export const sendNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => composeSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { dispatchNotification } = await import("./notifications.server");
    return dispatchNotification({
      title: data.title,
      body: data.body,
      url: data.url || "/",
      imageUrl: data.imageUrl || null,
      audience: data.audience,
      eventId: data.eventId ?? null,
      batch: data.batch ?? null,
      urgent: data.urgent,
      whatsapp: data.whatsapp,
      kind: data.kind ?? (data.urgent ? "safety" : "general"),
      source: data.source ?? "manual",
      createdBy: context.userId,
    });
  });

/** How many riders/devices a given audience currently reaches. */
export const previewAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        audience: z.enum(["all", "event", "batch"]),
        eventId: z.string().uuid().optional().nullable(),
        batch: z.string().trim().max(120).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;

    if (data.audience === "all") {
      const { count } = await admin.from("push_subscriptions").select("id", { count: "exact", head: true });
      return { devices: count ?? 0, riders: null as number | null };
    }
    if (!data.eventId) return { devices: 0, riders: 0 };

    let q = admin.from("event_entrants").select("entrant_id").eq("event_id", data.eventId);
    if (data.audience === "batch" && data.batch) q = q.eq("batch", data.batch);
    const { data: rows } = await q;
    const entrantIds = Array.from(new Set((rows ?? []).map((r: any) => r.entrant_id).filter(Boolean)));
    if (!entrantIds.length) return { devices: 0, riders: 0 };

    const userIds = new Set<string>();
    for (let i = 0; i < entrantIds.length; i += 500) {
      const { data: ents } = await admin
        .from("entrants")
        .select("user_id")
        .in("id", entrantIds.slice(i, i + 500));
      for (const e of ents ?? []) if (e.user_id) userIds.add(e.user_id);
    }
    if (!userIds.size) return { devices: 0, riders: 0 };
    const { count } = await admin
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .in("user_id", Array.from(userIds).slice(0, 1000));
    return { devices: count ?? 0, riders: userIds.size };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase
      .from("notifications")
      .select(
        "id, title, body, url, audience, event_id, batch, urgent, source, sent_at, recipients_count, delivered_count, failed_count, clicked_count",
      )
      .order("sent_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const notificationStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const [{ count: devices }, { count: riders }] = await Promise.all([
      admin.from("push_subscriptions").select("id", { count: "exact", head: true }),
      admin.from("notification_preferences").select("user_id", { count: "exact", head: true }),
    ]);
    return { devices: devices ?? 0, riders: riders ?? 0 };
  });
