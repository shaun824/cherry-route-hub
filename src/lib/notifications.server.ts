// Server-only notification fan-out: resolves the audience, writes the
// notification record, and pushes to every registered device.
import { sendWebPush, type PushTarget } from "./push.server";
import {
  loadOptOuts,
  normalizePhone,
  sendWhatsAppTemplate,
  sendWhatsAppText,
  waWindowOpen,
  whatsappConfigured,
} from "./whatsapp.server";

export type Audience = "all" | "event" | "batch";
export type NotificationKind = "news" | "event_reminder" | "safety" | "general";

export type WaTemplate = {
  name: string;
  language: string;
  /** Values for {{1}}, {{2}}… in the approved template body. */
  variables: string[];
};

export type DispatchInput = {
  title: string;
  body: string;
  url?: string | null;
  imageUrl?: string | null;
  audience: Audience;
  eventId?: string | null;
  batch?: string | null;
  urgent?: boolean;
  kind?: NotificationKind;
  whatsapp?: boolean;
  /** When set, WhatsApp goes out as an approved template (works outside 24h). */
  waTemplate?: WaTemplate | null;
  /** Skip push entirely — WhatsApp-only broadcast. */
  skipPush?: boolean;
  source?: string;
  dedupeKey?: string | null;
  createdBy?: string | null;
  onlyUserIds?: string[] | null;
};

export type DispatchResult = {
  notificationId: string | null;
  recipients: number;
  delivered: number;
  failed: number;
  whatsappSent: number;
  whatsappSkipped?: number;
  skipped?: string;
};


const CHUNK = 20;

function prefColumn(kind: NotificationKind): "news" | "event_reminders" | null {
  if (kind === "news") return "news";
  if (kind === "event_reminder") return "event_reminders";
  return null;
}

/** Resolves the set of user ids that should receive this notification. */
async function resolveUserIds(
  admin: any,
  input: DispatchInput,
): Promise<{ userIds: string[] | null; phones: string[] }> {
  if (input.onlyUserIds?.length) return { userIds: input.onlyUserIds, phones: [] };

  if (input.audience === "all") return { userIds: null, phones: [] };

  if (!input.eventId) return { userIds: [], phones: [] };

  let q = admin.from("event_entrants").select("entrant_id, batch").eq("event_id", input.eventId);
  if (input.audience === "batch" && input.batch) q = q.eq("batch", input.batch);
  const { data: rows, error } = await q;
  if (error) throw error;

  const entrantIds = Array.from(new Set((rows ?? []).map((r: any) => r.entrant_id).filter(Boolean)));
  if (!entrantIds.length) return { userIds: [], phones: [] };

  const userIds = new Set<string>();
  const phones = new Set<string>();
  for (let i = 0; i < entrantIds.length; i += 500) {
    const { data: ents } = await admin
      .from("entrants")
      .select("user_id, phone")
      .in("id", entrantIds.slice(i, i + 500));
    for (const e of ents ?? []) {
      if (e.user_id) userIds.add(e.user_id);
      if (e.phone) phones.add(String(e.phone));
    }
  }
  return { userIds: Array.from(userIds), phones: Array.from(phones) };
}

export async function dispatchNotification(input: DispatchInput): Promise<DispatchResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin: any = supabaseAdmin;
  const kind: NotificationKind = input.kind ?? "general";
  const urgent = Boolean(input.urgent);

  if (input.dedupeKey) {
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("dedupe_key", input.dedupeKey)
      .maybeSingle();
    if (existing) {
      return { notificationId: existing.id, recipients: 0, delivered: 0, failed: 0, whatsappSent: 0, skipped: "duplicate" };
    }
  }

  const { userIds, phones } = await resolveUserIds(admin, input);

  // Devices (skipped entirely for WhatsApp-only broadcasts)
  let subQuery = admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth");
  if (input.skipPush) subQuery = subQuery.eq("user_id", "00000000-0000-0000-0000-000000000000");

  if (userIds !== null) {
    if (!userIds.length) subQuery = subQuery.eq("user_id", "00000000-0000-0000-0000-000000000000");
    else subQuery = subQuery.in("user_id", userIds.slice(0, 1000));
  }
  const { data: subs, error: subErr } = await subQuery;
  if (subErr) throw subErr;

  // Preference filtering (urgent safety alerts ignore preferences)
  let targets = (subs ?? []) as Array<PushTarget & { user_id: string }>;
  const col = prefColumn(kind);
  if (!urgent && col && targets.length) {
    const uniqueUsers = Array.from(new Set(targets.map((t) => t.user_id)));
    const optedOut = new Set<string>();
    for (let i = 0; i < uniqueUsers.length; i += 500) {
      const { data: prefs } = await admin
        .from("notification_preferences")
        .select(`user_id, ${col}`)
        .in("user_id", uniqueUsers.slice(i, i + 500));
      for (const p of prefs ?? []) if ((p as any)[col] === false) optedOut.add(p.user_id);
    }
    targets = targets.filter((t) => !optedOut.has(t.user_id));
  }

  const channels = ["push", ...(input.whatsapp ? ["whatsapp"] : [])];
  const { data: created, error: createErr } = await admin
    .from("notifications")
    .insert({
      title: input.title,
      body: input.body,
      url: input.url || null,
      image_url: input.imageUrl || null,
      audience: input.audience,
      event_id: input.eventId || null,
      batch: input.batch || null,
      urgent,
      channels,
      source: input.source ?? "manual",
      dedupe_key: input.dedupeKey || null,
      created_by: input.createdBy || null,
      recipients_count: targets.length,
    })
    .select("id")
    .single();
  if (createErr) throw createErr;
  const notificationId = created.id as string;

  let delivered = 0;
  let failed = 0;
  const deliveries: any[] = [];
  const deadIds: string[] = [];

  for (let i = 0; i < targets.length; i += CHUNK) {
    const slice = targets.slice(i, i + CHUNK);
    const results = await Promise.all(
      slice.map((t) =>
        sendWebPush(
          t,
          {
            title: input.title,
            body: input.body,
            url: input.url || "/",
            image: input.imageUrl || undefined,
            urgent,
            notificationId,
            deliveryId: `${notificationId}:${t.id}`,
            tag: input.dedupeKey || notificationId,
          },
          { urgent },
        ),
      ),
    );
    results.forEach((res, idx) => {
      const t = slice[idx]!;
      if (res.ok) {
        delivered += 1;
        deliveries.push({
          notification_id: notificationId,
          user_id: t.user_id,
          subscription_id: t.id,
          channel: "push",
          status: "sent",
        });
      } else {
        failed += 1;
        if (res.gone) deadIds.push(t.id);
        deliveries.push({
          notification_id: notificationId,
          user_id: t.user_id,
          subscription_id: t.id,
          channel: "push",
          status: res.gone ? "expired" : "failed",
          error: res.error,
        });
      }
    });
  }

  if (deliveries.length) {
    for (let i = 0; i < deliveries.length; i += 500) {
      await admin.from("notification_deliveries").insert(deliveries.slice(i, i + 500));
    }
  }
  if (deadIds.length) await admin.from("push_subscriptions").delete().in("id", deadIds);

  // Optional WhatsApp broadcast. Templates work any time; free-form text is
  // only allowed inside Meta's 24h window after the rider messaged us.
  let whatsappSent = 0;
  let whatsappSkipped = 0;
  if (input.whatsapp && whatsappConfigured() && phones.length) {
    const normalized = Array.from(new Set(phones.map(normalizePhone).filter(Boolean)));
    const optedOut = await loadOptOuts(admin, normalized);
    const eligible = normalized.filter((p) => !optedOut.has(p));
    whatsappSkipped += normalized.length - eligible.length;

    const text = `*${input.title}*\n\n${input.body}${input.url ? `\n\n${input.url}` : ""}`;
    const tpl = input.waTemplate ?? null;
    const waRows: any[] = [];

    for (let i = 0; i < eligible.length; i += 10) {
      const slice = eligible.slice(i, i + 10);
      const results = await Promise.allSettled(
        slice.map(async (p) => {
          if (tpl) return sendWhatsAppTemplate(p, tpl.name, tpl.language, tpl.variables);
          if (!(await waWindowOpen(admin, p))) throw new Error("outside-24h-window");
          return sendWhatsAppText(p, text);
        }),
      );
      results.forEach((r, idx) => {
        const phone = slice[idx]!;
        const outsideWindow =
          r.status === "rejected" && String((r as PromiseRejectedResult).reason).includes("outside-24h-window");
        if (r.status === "fulfilled") whatsappSent += 1;
        else if (outsideWindow) whatsappSkipped += 1;
        waRows.push({
          notification_id: notificationId,
          channel: "whatsapp",
          wa_phone: phone,
          wa_message_id: r.status === "fulfilled" ? r.value || null : null,
          wa_status: r.status === "fulfilled" ? "accepted" : outsideWindow ? "skipped" : "failed",
          status: r.status === "fulfilled" ? "sent" : outsideWindow ? "skipped" : "failed",
          error:
            r.status === "rejected" ? String((r as PromiseRejectedResult).reason).slice(0, 300) : null,
        });
      });
    }
    for (let i = 0; i < waRows.length; i += 500) {
      await admin.from("notification_deliveries").insert(waRows.slice(i, i + 500));
    }
  }

  await admin
    .from("notifications")
    .update({ delivered_count: delivered, failed_count: failed })
    .eq("id", notificationId);

  return { notificationId, recipients: targets.length, delivered, failed, whatsappSent, whatsappSkipped };

}
