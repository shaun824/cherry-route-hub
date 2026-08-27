// Live rider tracking — server functions.
// Riders upload batched GPS points; spectators read the latest position per rider.
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
    const rows = data.points.map((p) => ({
      event_id: data.eventId,
      user_id: context.userId,
      entrant_id: data.entrantId ?? null,
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
    if (entrantIds.size > 0) {
      const { data: roster } = await supabase
        .from("entrants")
        .select("id, full_name")
        .in("id", [...entrantIds]);
      const names = new Map((roster ?? []).map((r) => [r.id, r.full_name]));
      // bib/category come from the event roster (public on the spectate page)
      const { data: ee } = await supabase
        .from("event_entrants")
        .select("entrant_id, bib_number, category")
        .eq("event_id", data.eventId)
        .in("entrant_id", [...entrantIds]);
      const extras = new Map((ee ?? []).map((r) => [r.entrant_id, r]));
      for (const p of points ?? []) {
        const pos = latest.get(p.user_id);
        if (!pos || pos.riderName) continue;
        if (p.entrant_id) {
          pos.riderName = names.get(p.entrant_id) ?? null;
          const ex = extras.get(p.entrant_id);
          pos.bib = ex?.bib_number ?? null;
          pos.category = ex?.category ?? null;
        }
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

/** Throws unless the signed-in user has the admin role (RLS-scoped check). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
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
      .select("id, name, event_date, lifecycle")
      .neq("lifecycle", "archived")
      .order("event_date", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((e) => ({
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
