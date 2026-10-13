// Server-only Strava helpers: OAuth state signing, token refresh, effort sync.
const API = "https://www.strava.com/api/v3";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

async function hmac(text: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env("STRAVA_CLIENT_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, (c) =>
    c === "+" ? "-" : c === "/" ? "_" : "",
  );
}

export async function signState(userId: string, returnTo: string) {
  const payload = btoa(JSON.stringify({ u: userId, r: returnTo, t: Date.now() }));
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyState(state: string): Promise<{ userId: string; returnTo: string } | null> {
  const [payload, sig] = state.split(".");
  if (!payload || !sig || (await hmac(payload)) !== sig) return null;
  try {
    const p = JSON.parse(atob(payload));
    if (Date.now() - p.t > 30 * 60_000) return null;
    const r = typeof p.r === "string" && p.r.startsWith("/") && !p.r.startsWith("//") ? p.r : "/profile";
    return { userId: String(p.u), returnTo: r };
  } catch {
    return null;
  }
}

export function authorizeUrl(origin: string, state: string) {
  const u = new URL("https://www.strava.com/oauth/authorize");
  u.searchParams.set("client_id", env("STRAVA_CLIENT_ID"));
  u.searchParams.set("redirect_uri", `${origin}/api/public/strava/callback`);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("approval_prompt", "auto");
  u.searchParams.set("scope", "read,activity:read_all");
  u.searchParams.set("state", state);
  return u.toString();
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: env("STRAVA_CLIENT_ID"),
      client_secret: env("STRAVA_CLIENT_SECRET"),
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Strava token request failed [${res.status}]: ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    athlete?: { id: number; firstname?: string; lastname?: string };
  };
}

export async function exchangeCode(code: string) {
  return tokenRequest({ code, grant_type: "authorization_code" });
}

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export async function accessTokenFor(admin: Admin, userId: string) {
  const { data: c } = await admin
    .from("strava_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!c) return null;
  if (new Date(c.expires_at).getTime() > Date.now() + 120_000) return c.access_token;
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: c.refresh_token });
  await admin
    .from("strava_connections")
    .update({
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: new Date(t.expires_at * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  return t.access_token;
}

async function get<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Strava request failed [${res.status}]: ${await res.text()}`);
  return (await res.json()) as T;
}

/** Pull the rider's rides on the event days and store their segment efforts. */
export async function syncEventEfforts(
  admin: Admin,
  userId: string,
  eventId: string,
): Promise<{ activities: number; efforts: number }> {
  const token = await accessTokenFor(admin, userId);
  if (!token) return { activities: 0, efforts: 0 };

  const { data: ev } = await admin.from("events").select("event_date").eq("id", eventId).maybeSingle();
  if (!ev?.event_date) return { activities: 0, efforts: 0 };

  // Find this user's entry on the event (for category comparisons).
  const { data: ents } = await admin.from("entrants").select("id").eq("user_id", userId);
  const entrantIds = (ents ?? []).map((e) => e.id);
  const { data: ee } = entrantIds.length
    ? await admin
        .from("event_entrants")
        .select("id, category")
        .eq("event_id", eventId)
        .in("entrant_id", entrantIds)
        .limit(1)
        .maybeSingle()
    : { data: null };

  const start = new Date(`${ev.event_date}T00:00:00+02:00`).getTime() / 1000;
  const after = Math.floor(start - 86400);
  const before = Math.floor(start + 4 * 86400);
  const acts = await get<Array<{ id: number; type: string; sport_type?: string }>>(
    token,
    `/athlete/activities?after=${after}&before=${before}&per_page=30`,
  );
  const rides = acts.filter((a) => /ride/i.test(a.sport_type ?? a.type));

  let efforts = 0;
  for (const a of rides) {
    const detail = await get<{
      segment_efforts?: Array<{
        id: number;
        elapsed_time: number;
        start_date: string;
        segment: { id: number; name: string; distance: number; average_grade: number; private?: boolean };
      }>;
    }>(token, `/activities/${a.id}?include_all_efforts=true`);
    const rows = (detail.segment_efforts ?? [])
      .filter((s) => !s.segment.private)
      .map((s) => ({
        id: s.id,
        event_id: eventId,
        user_id: userId,
        event_entrant_id: ee?.id ?? null,
        category: ee?.category ?? null,
        activity_id: a.id,
        segment_id: s.segment.id,
        segment_name: s.segment.name,
        distance_m: s.segment.distance,
        average_grade: s.segment.average_grade,
        elapsed_s: s.elapsed_time,
        start_date: s.start_date,
      }));
    if (rows.length) {
      const { error } = await admin.from("strava_segment_efforts").upsert(rows);
      if (error) throw new Error(error.message);
      efforts += rows.length;
    }
  }
  return { activities: rides.length, efforts };
}
