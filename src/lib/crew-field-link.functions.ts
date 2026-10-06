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
