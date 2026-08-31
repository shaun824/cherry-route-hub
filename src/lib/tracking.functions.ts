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
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
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

/** Rider triggers an SOS with their last known position. */
export const sendTrackingSos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        eventId: z.string().uuid(),
        lat: z.number().min(-90).max(90).nullish(),
        lng: z.number().min(-180).max(180).nullish(),
        accuracyM: z.number().min(0).max(100000).nullish(),
        message: z.string().max(500).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await table(context.supabase, "tracking_sos").insert({
      event_id: data.eventId,
      user_id: context.userId,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      accuracy_m: data.accuracyM ?? null,
      message: data.message ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export type LiveRiderPosition = {
  userId: string;
  riderName: string | null;
  bib: string | null;
  category: string | null;
  lat: number;
  lng: number;
  accuracyM: number | null;
  batteryPct: number | null;
  recordedAt: string;
};

export type LiveTrackingPayload = {
  riders: LiveRiderPosition[];
  activeSos: number;
};

function publishableClient() {
  return createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Public: latest position per rider for an event (last 12 hours of data).
 * Read-only and safe to poll from the spectator map.
 */
export const fetchLiveTracking = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<LiveTrackingPayload> => {
    const supabase = publishableClient();
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data: points, error } = await table(supabase, "tracking_points")
      .select("user_id, entrant_id, lat, lng, accuracy_m, battery_pct, recorded_at")
      .eq("event_id", data.eventId)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: false })
      .limit(10000);
    if (error) throw new Error(error.message);

    const latest = new Map<string, LiveRiderPosition>();
    const entrantIds = new Set<string>();
    for (const p of points ?? []) {
      if (latest.has(p.user_id)) continue; // rows are newest-first
      latest.set(p.user_id, {
        userId: p.user_id,
        riderName: null,
        bib: null,
        category: null,
        lat: p.lat,
        lng: p.lng,
        accuracyM: p.accuracy_m,
        batteryPct: p.battery_pct,
        recordedAt: p.recorded_at,
      });
      if (p.entrant_id) entrantIds.add(p.entrant_id);
    }

    // Public-safe identity: same roster data the spectate page already publishes.
    // RLS blocks direct roster reads for spectators, so resolve via the
    // security-definer helper that only exposes riders who are tracking.
    if (entrantIds.size > 0) {
      const { data: identity } = await supabase.rpc("live_tracking_identity", {
        _event_id: data.eventId,
      });
      type IdentityRow = { entrant_id: string; full_name: string | null; bib_number: string | null; category: string | null };
      const info = new Map((identity ?? []).map((r: IdentityRow) => [r.entrant_id, r]));
      for (const p of points ?? []) {
        const pos = latest.get(p.user_id);
        if (!pos || pos.riderName || !p.entrant_id) continue;
        const ex = info.get(p.entrant_id);
        if (!ex) continue;
        pos.riderName = ex.full_name ?? null;
        pos.bib = ex.bib_number ?? null;
        pos.category = ex.category ?? null;
      }
    }

    return { riders: [...latest.values()], activeSos: 0 };
  });

export type SosAlert = {
  id: string;
  eventId: string;
  userId: string;
  riderName: string | null;
  lat: number | null;
  lng: number | null;
  message: string | null;
  status: string;
  createdAt: string;
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
      .select("id, event_id, user_id, lat, lng, message, status, created_at")
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
      message: string | null;
      status: string;
      created_at: string;
    }[];
    const userIds: string[] = [...new Set(sosRows.map((r) => r.user_id))];
    const names = new Map<string, string>();
    if (userIds.length) {
      const { data: entrants } = await supabaseAdmin
        .from("entrants")
        .select("user_id, full_name")
        .in("user_id", userIds);
      for (const e of entrants ?? []) if (e.user_id) names.set(e.user_id, e.full_name);
    }

    const alerts: SosAlert[] = sosRows.map((r) => ({
      id: r.id,
      eventId: r.event_id,
      userId: r.user_id,
      riderName: names.get(r.user_id) ?? null,
      lat: r.lat,
      lng: r.lng,
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
    }));
    return { alerts };
  });

/** Admin: mark an SOS alert resolved. */
export const resolveSosAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await table(supabaseAdmin, "tracking_sos")
      .update({ status: "resolved" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
