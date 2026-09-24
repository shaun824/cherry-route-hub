// Live rider tracking — server functions.
// Riders upload batched GPS points; spectators read the latest position per rider.
import { visibleInBackend } from "@/lib/event-window";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type TrackingPointInput = {
  lat: number;
  lng: number;
  accuracyM?: number | null;
  batteryPct?: number | null;
  recordedAt: string; // ISO timestamp from the device
};

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(100000).nullish(),
  batteryPct: z.number().int().min(0).max(100).nullish(),
  recordedAt: z.string(),
});

// New tables aren't in the generated Database types yet — narrow local helper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (client: any, name: string) => client.from(name as never) as any;

/** Rider uploads a batch of GPS points. Validates the rider owns the entry's session. */
export const uploadTrackingPoints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        eventId: z.string().uuid(),
        entrantId: z.string().uuid().nullish(),
        points: z.array(pointSchema).min(1).max(200),
        sessionStartedAt: z.number().nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // Session cap: admin/crew tests stop after 3h, riders after 12h (+1h grace for "Keep tracking").
    if (data.sessionStartedAt) {
      const { data: roles } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);
      const staff = (roles ?? []).some((r: { role: string }) => r.role === "admin" || r.role === "crew");
      const limit = (staff ? 3 : 13) * 60 * 60_000 + 5 * 60_000;
      if (Date.now() - data.sessionStartedAt > limit) {
        return { ok: false as const, expired: true as const, uploaded: 0 };
      }
    }
    // Resolve the rider's entrant row so the live map can label the pin with
    // their name/bib instead of showing an anonymous dot.
    let entrantId = data.entrantId ?? null;
    if (!entrantId) {
      const { data: mine } = await context.supabase
        .from("entrants")
        .select("id")
        .eq("user_id", context.userId)
        .limit(1);
      entrantId = mine?.[0]?.id ?? null;
    }
    const rows = data.points.map((p) => ({
      event_id: data.eventId,
      user_id: context.userId,
      entrant_id: entrantId,
      lat: p.lat,
      lng: p.lng,
      accuracy_m: p.accuracyM ?? null,
      battery_pct: p.batteryPct ?? null,
      recorded_at: p.recordedAt,
    }));
    const { error } = await table(context.supabase, "tracking_points").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true as const, uploaded: rows.length };
  });


/**
 * Has the signed-in rider finished this event?
 * A rider is "done" once their own entry has a finish time or their own row
 * appears in the imported results with a time — not when results in general
 * are published.
 */
export const getMyResultStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: mine } = await context.supabase
      .from("entrants")
      .select("id, full_name")
      .eq("user_id", context.userId)
      .limit(1);
    const entrant = mine?.[0];
    if (!entrant) return { finished: false as const };

    const { data: ee } = await context.supabase
      .from("event_entrants")
      .select("bib_number, finished_at")
      .eq("event_id", data.eventId)
      .eq("entrant_id", entrant.id)
      .maybeSingle();
    if (ee?.finished_at) return { finished: true as const };

    const bib = ee?.bib_number ?? null;
    const name = (entrant.full_name ?? "").trim();
    let query = context.supabase
      .from("event_results")
      .select("time_text, time_ms, status")
      .eq("event_id", data.eventId)
      .limit(10);
    query = bib ? query.eq("bib_number", bib) : query.ilike("full_name", name || "\u0000");
    const { data: rows } = await query;
    const finished = (rows ?? []).some(
      (r: { time_text: string | null; time_ms: number | null; status: string | null }) =>
        r.time_ms != null || (r.time_text != null && r.time_text.trim() !== "") ||
        /finish|fin\b/i.test(r.status ?? ""),
    );
    return { finished };
  });

export const SOS_REASONS = ["medical", "mechanical", "lost", "other", "checking-in"] as const;
export type SosReason = (typeof SOS_REASONS)[number];

export const SOS_REASON_LABELS: Record<SosReason, string> = {
  medical: "Medical",
  mechanical: "Mechanical",
  lost: "Lost / off course",
  other: "Other",
  "checking-in": "Just checking in",
};

/** Crew + admin user ids — the people who must hear about an SOS. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function crewUserIds(admin: any, exclude?: string[]): Promise<string[]> {
  const { data } = await admin.from("user_roles").select("user_id").in("role", ["admin", "crew"]);
  const ids = [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
  return exclude?.length ? ids.filter((id) => !exclude.includes(id)) : ids;
}

/** Rider triggers an SOS with their last known position, reason and note. */
export const sendTrackingSos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        eventId: z.string().uuid(),
        lat: z.number().min(-90).max(90).nullish(),
        lng: z.number().min(-180).max(180).nullish(),
        accuracyM: z.number().min(0).max(100000).nullish(),
        reason: z.enum(SOS_REASONS).nullish(),
        message: z.string().max(500).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await table(context.supabase, "tracking_sos")
      .insert({
        event_id: data.eventId,
        user_id: context.userId,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        accuracy_m: data.accuracyM ?? null,
        reason: data.reason ?? null,
        note: data.message ?? null,
        message: data.message ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Push to every crew/admin device so an alert never depends on someone
    // having the race-control tab open.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { dispatchNotification } = await import("./notifications.server");
      const ids = await crewUserIds(supabaseAdmin);
      const { data: me } = await supabaseAdmin
        .from("entrants")
        .select("full_name")
        .eq("user_id", context.userId)
        .limit(1);
      const rider = me?.[0]?.full_name ?? "A rider";
      const reasonLabel = data.reason ? SOS_REASON_LABELS[data.reason] : "SOS";
      if (ids.length) {
        await dispatchNotification({
          title: `SOS · ${reasonLabel}`,
          body: `${rider} sent an SOS${data.message ? ` — ${data.message}` : ""}`,
          url: "/crew/tracking",
          audience: "all",
          onlyUserIds: ids,
          urgent: true,
          kind: "safety",
          source: "sos",
          dedupeKey: `sos-${inserted?.id ?? Date.now()}`,
          createdBy: context.userId,
        });
      }
    } catch (err) {
      console.error("[sos] push fan-out failed:", err);
    }

    return { ok: true as const, id: inserted?.id ?? null };
  });

/** Rider cancels/downgrades their own active SOS ("I'm okay now"). */
export const cancelMySos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await table(context.supabase, "tracking_sos")
      .update({ status: "cancelled" })
      .eq("event_id", data.eventId)
      .eq("user_id", context.userId)
      .in("status", ["active", "acknowledged"]);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Rider: their own open SOS for this event, if any. */
export const fetchMySos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows } = await table(context.supabase, "tracking_sos")
      .select("id, status, reason, note, created_at, acknowledged_at")
      .eq("event_id", data.eventId)
      .eq("user_id", context.userId)
      .in("status", ["active", "acknowledged"])
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (rows ?? [])[0] ?? null;
    return {
      open: row
        ? {
            id: row.id as string,
            status: row.status as string,
            reason: (row.reason ?? null) as string | null,
            note: (row.note ?? null) as string | null,
            createdAt: row.created_at as string,
            acknowledgedAt: (row.acknowledged_at ?? null) as string | null,
          }
        : null,
    };
  });


export type LiveRiderPosition = {
  userId: string;
  riderName: string | null;
  bib: string | null;
  category: string | null;
  batch: string | null;
  lat: number;
  lng: number;
  accuracyM: number | null;
  batteryPct: number | null;
  recordedAt: string;
  /** Rider has an open (active/acknowledged) SOS. */
  sos: boolean;
  sosReason: string | null;
  /** Rider has a recorded finish time for this event. */
  finished: boolean;
  /** Milliseconds this rider has been effectively stationary, else null. */
  stoppedForMs: number | null;
};

export type LiveTrackingPayload = {
  riders: LiveRiderPosition[];
  activeSos: number;
  /** Start of the window the feed covers (current stage day). */
  since: string;
};

function publishableClient() {
  return createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** Start of the current racing day in SAST (UTC+2), never more than 12h back. */
function currentDayStartIso(now = Date.now()): string {
  const offsetMs = 2 * 60 * 60 * 1000;
  const local = new Date(now + offsetMs);
  local.setUTCHours(0, 0, 0, 0);
  const dayStart = local.getTime() - offsetMs;
  return new Date(Math.max(dayStart, now - 12 * 60 * 60 * 1000)).toISOString();
}

// A rider who hasn't moved more than this in the window below counts as stopped.
const STOPPED_RADIUS_M = 60;
const STOPPED_WINDOW_MS = 12 * 60_000;
const STOPPED_MIN_MS = 8 * 60_000;

function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/**
 * Public: latest position per rider for an event, scoped to the current racing
 * day. Read-only and safe to poll from the spectator map.
 */
export const fetchLiveTracking = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<LiveTrackingPayload> => {
    const supabase = publishableClient();
    const since = currentDayStartIso();
    const { data: points, error } = await table(supabase, "tracking_points")
      .select("user_id, entrant_id, lat, lng, accuracy_m, battery_pct, recorded_at")
      .eq("event_id", data.eventId)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false })
      .limit(20000);
    if (error) throw new Error(error.message);

    const latest = new Map<string, LiveRiderPosition>();
    const entrantIds = new Set<string>();
    const history = new Map<string, { lat: number; lng: number; t: number }[]>();
    for (const p of points ?? []) {
      const t = new Date(p.recorded_at).getTime();
      if (!latest.has(p.user_id)) {
        latest.set(p.user_id, {
          userId: p.user_id,
          riderName: null,
          bib: null,
          category: null,
          batch: null,
          lat: p.lat,
          lng: p.lng,
          accuracyM: p.accuracy_m,
          batteryPct: p.battery_pct,
          recordedAt: p.recorded_at,
          sos: false,
          sosReason: null,
          finished: false,
          stoppedForMs: null,
        });
        if (p.entrant_id) entrantIds.add(p.entrant_id);
      }
      const newest = new Date(latest.get(p.user_id)!.recordedAt).getTime();
      if (newest - t <= STOPPED_WINDOW_MS) {
        const arr = history.get(p.user_id) ?? [];
        arr.push({ lat: p.lat, lng: p.lng, t });
        history.set(p.user_id, arr);
      }
    }

    // "Stopped" = every recent point sits inside a small radius of the latest.
    for (const [userId, pos] of latest) {
      const pts = history.get(userId) ?? [];
      if (pts.length < 2) continue;
      const oldest = pts[pts.length - 1];
      const span = new Date(pos.recordedAt).getTime() - oldest.t;
      if (span < STOPPED_MIN_MS) continue;
      const moved = pts.every(
        (p) => metresBetween(pos.lat, pos.lng, p.lat, p.lng) <= STOPPED_RADIUS_M,
      );
      if (moved) pos.stoppedForMs = span;
    }

    // Public-safe identity: same roster data the spectate page already publishes.
    // RLS blocks direct roster reads for spectators, so resolve via the
    // security-definer helper that only exposes riders who are tracking.
    if (entrantIds.size > 0) {
      const { data: identity, error: identityError } = await supabase.rpc(
        "live_tracking_identity_v2",
        { _event_id: data.eventId },
      );
      if (identityError) {
        console.error("[live-tracking] live_tracking_identity_v2 failed:", identityError.message);
      }
      type IdentityRow = {
        entrant_id: string;
        full_name: string | null;
        bib_number: string | null;
        category: string | null;
        batch: string | null;
        finished_at: string | null;
      };
      const info = new Map((identity ?? []).map((r: IdentityRow) => [r.entrant_id, r]));
      for (const p of points ?? []) {
        const pos = latest.get(p.user_id);
        if (!pos || pos.riderName || !p.entrant_id) continue;
        const ex = info.get(p.entrant_id);
        if (!ex) continue;
        pos.riderName = ex.full_name ?? null;
        pos.bib = ex.bib_number ?? null;
        pos.category = ex.category ?? null;
        pos.batch = ex.batch ?? null;
        pos.finished = Boolean(ex.finished_at);
      }
    }

    // Open SOS alerts — flagged on the rider so their pin can shout.
    const { data: sosRows } = await supabase.rpc("live_tracking_sos_flags", {
      _event_id: data.eventId,
    });
    let activeSos = 0;
    for (const s of (sosRows ?? []) as { user_id: string; reason: string | null; status: string }[]) {
      if (s.status === "active") activeSos += 1;
      const pos = latest.get(s.user_id);
      if (pos) {
        pos.sos = true;
        pos.sosReason = s.reason;
      }
    }

    return { riders: [...latest.values()], activeSos, since };

  });

export type SosAlert = {
  id: string;
  eventId: string;
  userId: string;
  riderName: string | null;
  bib: string | null;
  lat: number | null;
  lng: number | null;
  reason: string | null;
  note: string | null;
  message: string | null;
  status: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedByName: string | null;
  escalatedAt: string | null;
};


/**
 * Throws unless the signed-in user is crew or admin (RLS-scoped check).
 * Riders never reach SOS alerts or the full field view.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "crew"])
    .limit(1);
  if (!data || data.length === 0) throw new Error("Forbidden");
}

/** Admin: events available for the race-control view (newest first). */
export const fetchTrackingEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("events")
      .select("id, name, event_date, lifecycle, days")
      .neq("lifecycle", "archived")
      .order("event_date", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    return visibleInBackend(data ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      eventDate: e.event_date,
      lifecycle: e.lifecycle,
    }));
  });

/** Admin: list SOS alerts, optionally filtered to an event. */
export const fetchSosAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ eventId: z.string().uuid().nullish() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = table(supabaseAdmin, "tracking_sos")
      .select(
        "id, event_id, user_id, lat, lng, reason, note, message, status, created_at, acknowledged_at, acknowledged_by, escalated_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.eventId) q = q.eq("event_id", data.eventId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const sosRows = (rows ?? []) as {
      id: string;
      event_id: string;
      user_id: string;
      lat: number | null;
      lng: number | null;
      reason: string | null;
      note: string | null;
      message: string | null;
      status: string;
      created_at: string;
      acknowledged_at: string | null;
      acknowledged_by: string | null;
      escalated_at: string | null;
    }[];
    const userIds: string[] = [
      ...new Set([
        ...sosRows.map((r) => r.user_id),
        ...sosRows.map((r) => r.acknowledged_by).filter((v): v is string => Boolean(v)),
      ]),
    ];
    const names = new Map<string, string>();
    const bibs = new Map<string, string>();
    if (userIds.length) {
      const { data: entrants } = await supabaseAdmin
        .from("entrants")
        .select("user_id, full_name")
        .in("user_id", userIds);
      for (const e of entrants ?? []) if (e.user_id) names.set(e.user_id, e.full_name);
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      for (const p of profiles ?? [])
        if (!names.has(p.id)) names.set(p.id, p.full_name ?? p.email ?? "Crew");
      if (data.eventId) {
        const entrantUserIds = sosRows.map((r) => r.user_id);
        const { data: ee } = await supabaseAdmin
          .from("event_entrants")
          .select("bib_number, entrants!inner(user_id)")
          .eq("event_id", data.eventId);
        for (const row of (ee ?? []) as unknown as {
          bib_number: string | null;
          entrants: { user_id: string | null } | null;
        }[]) {
          const uid = row.entrants?.user_id;
          if (uid && row.bib_number && entrantUserIds.includes(uid)) bibs.set(uid, row.bib_number);
        }
      }
    }

    const alerts: SosAlert[] = sosRows.map((r) => ({
      id: r.id,
      eventId: r.event_id,
      userId: r.user_id,
      riderName: names.get(r.user_id) ?? null,
      bib: bibs.get(r.user_id) ?? null,
      lat: r.lat,
      lng: r.lng,
      reason: r.reason,
      note: r.note ?? r.message,
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
      acknowledgedAt: r.acknowledged_at,
      acknowledgedByName: r.acknowledged_by ? (names.get(r.acknowledged_by) ?? "Crew") : null,
      escalatedAt: r.escalated_at,
    }));
    return { alerts };
  });

/** Crew: confirm a human has seen the alert. Stops the alarm; keeps it open. */
export const acknowledgeSosAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await table(supabaseAdmin, "tracking_sos")
      .update({
        status: "acknowledged",
        acknowledged_by: context.userId,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "active");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Crew screen escalates an alert nobody acknowledged in time: records the
 * escalation once and re-pushes to every other crew/admin device.
 */
export const escalateSosAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await table(supabaseAdmin, "tracking_sos")
      .select("id, user_id, reason, note, escalated_at, status")
      .eq("id", data.id)
      .limit(1);
    const row = (rows ?? [])[0];
    if (!row || row.escalated_at || row.status !== "active") return { ok: true as const, sent: false };

    await table(supabaseAdmin, "tracking_sos")
      .update({ escalated_at: new Date().toISOString() })
      .eq("id", data.id);

    const { dispatchNotification } = await import("./notifications.server");
    const ids = await crewUserIds(supabaseAdmin, [context.userId]);
    const { data: me } = await supabaseAdmin
      .from("entrants")
      .select("full_name")
      .eq("user_id", row.user_id)
      .limit(1);
    if (ids.length) {
      await dispatchNotification({
        title: "SOS NOT ACKNOWLEDGED",
        body: `${me?.[0]?.full_name ?? "A rider"} is still waiting — nobody has acknowledged this SOS.`,
        url: "/crew/tracking",
        audience: "all",
        onlyUserIds: ids,
        urgent: true,
        kind: "safety",
        source: "sos-escalation",
        dedupeKey: `sos-escalate-${data.id}`,
        createdBy: context.userId,
      });
    }
    return { ok: true as const, sent: ids.length > 0 };
  });

/** Admin: mark an SOS alert resolved (closes the incident). */
export const resolveSosAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await table(supabaseAdmin, "tracking_sos")
      .update({
        status: "resolved",
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

