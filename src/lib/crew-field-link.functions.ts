// No-sign-in crew field links for race control (medics, marshals).
// The link carries an expiring HMAC token tied to one event; the server checks
// it before returning SOS details. Acknowledging/resolving still needs sign-in.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LINK_DAYS = 5;

function b64url(buf: ArrayBuffer) {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(eventId: string, exp: number) {
  const secret = process.env.CREW_LINK_SECRET;
  if (!secret) throw new Error("Crew link secret missing");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`crew-tracking:${eventId}:${exp}`),
  );
  return b64url(sig).slice(0, 32);
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function verify(eventId: string, token: string) {
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < Date.now()) return false;
  return safeEqual(sig, await sign(eventId, exp));
}

/** Crew/admin: mint a shareable no-sign-in race-control link for an event. */
export const createCrewFieldLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["admin", "crew"])
      .limit(1);
    if (!roles || roles.length === 0) throw new Error("Forbidden");
    const exp = Date.now() + LINK_DAYS * 24 * 60 * 60 * 1000;
    return { token: `${exp}.${await sign(data.eventId, exp)}`, expiresAt: new Date(exp).toISOString() };
  });

/** Public: check a field link and return the event name + open SOS alerts. */
export const fetchFieldLinkSos = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ eventId: z.string().uuid(), token: z.string().min(10).max(80) }).parse(input),
  )
  .handler(async ({ data }) => {
    if (!(await verify(data.eventId, data.token))) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ev } = await supabaseAdmin
      .from("events")
      .select("name")
      .eq("id", data.eventId)
      .maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows } = await (supabaseAdmin as any)
      .from("tracking_sos")
      .select("id, user_id, lat, lng, reason, note, status, created_at")
      .eq("event_id", data.eventId)
      .in("status", ["active", "acknowledged"])
      .order("created_at", { ascending: false })
      .limit(50);
    const sos = (rows ?? []) as {
      id: string;
      user_id: string;
      lat: number | null;
      lng: number | null;
      reason: string | null;
      note: string | null;
      status: string;
      created_at: string;
    }[];
    const names = new Map<string, string>();
    if (sos.length) {
      const { data: ents } = await supabaseAdmin
        .from("entrants")
        .select("user_id, full_name")
        .in("user_id", sos.map((s) => s.user_id));
      for (const e of ents ?? []) if (e.user_id) names.set(e.user_id, e.full_name);
    }
    return {
      ok: true as const,
      eventName: ev?.name ?? "Race control",
      alerts: sos.map((s) => ({
        id: s.id,
        userId: s.user_id,
        riderName: names.get(s.user_id) ?? null,
        lat: s.lat,
        lng: s.lng,
        reason: s.reason,
        note: s.note,
        status: s.status,
        createdAt: s.created_at,
      })),
    };
  });

// ---- Team locations (crew + field-link holders see each other) -------------
const locInput = z.object({
  eventId: z.string().uuid(),
  token: z.string().max(80).optional(),
  deviceId: z.string().min(8).max(64),
  name: z.string().trim().min(1).max(60),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
const readInput = z.object({ eventId: z.string().uuid(), token: z.string().max(80).optional() });

async function isCrewUser(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "crew"]).limit(1);
  return Boolean(data && data.length);
}

async function writeLoc(d: z.infer<typeof locInput>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any).from("crew_locations").upsert({
    event_id: d.eventId, device_id: d.deviceId, name: d.name, lat: d.lat, lng: d.lng, updated_at: new Date().toISOString(),
  });
  return { ok: true };
}

async function readLocs(eventId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data } = await (supabaseAdmin as any)
    .from("crew_locations")
    .select("device_id, name, lat, lng, updated_at")
    .eq("event_id", eventId)
    .gte("updated_at", since)
    .limit(200);
  return (data ?? []).map((r: any) => ({ deviceId: r.device_id as string, name: r.name as string, lat: r.lat as number, lng: r.lng as number, updatedAt: r.updated_at as string }));
}

export const shareTeamLocationField = createServerFn({ method: "POST" })
  .inputValidator((i) => locInput.parse(i))
  .handler(async ({ data }) => {
    if (!data.token || !(await verify(data.eventId, data.token))) throw new Error("Link expired");
    return writeLoc(data);
  });

export const shareTeamLocationCrew = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => locInput.parse(i))
  .handler(async ({ data, context }) => {
    if (!(await isCrewUser(context.supabase, context.userId))) throw new Error("Forbidden");
    return writeLoc(data);
  });

export const fetchTeamLocationsField = createServerFn({ method: "POST" })
  .inputValidator((i) => readInput.parse(i))
  .handler(async ({ data }) => {
    if (!data.token || !(await verify(data.eventId, data.token))) return [];
    return readLocs(data.eventId);
  });

export const fetchTeamLocationsCrew = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => readInput.parse(i))
  .handler(async ({ data, context }) => {
    if (!(await isCrewUser(context.supabase, context.userId))) return [];
    return readLocs(data.eventId);
  });
