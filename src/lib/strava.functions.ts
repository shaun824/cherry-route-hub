import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startStravaConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ returnTo: z.string().max(300) }).parse(i))
  .handler(async ({ data, context }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { signState, authorizeUrl } = await import("@/lib/strava.server");
    const origin = new URL(getRequest().url).origin;
    return { url: authorizeUrl(origin, await signState(context.userId, data.returnTo)) };
  });

export const disconnectStrava = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("strava_connections").delete().eq("user_id", context.userId);
    await supabaseAdmin.from("strava_segment_efforts").delete().eq("user_id", context.userId);
    return { ok: true };
  });

export const syncMyStrava = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ eventId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncEventEfforts } = await import("@/lib/strava.server");
    try {
      return { ok: true as const, ...(await syncEventEfforts(supabaseAdmin, context.userId, data.eventId)) };
    } catch (e) {
      console.error("Strava sync failed", e);
      return { ok: false as const, error: e instanceof Error ? e.message : "Sync failed" };
    }
  });

export type StravaSegmentRow = {
  segment_id: number;
  name: string;
  distance_m: number | null;
  average_grade: number | null;
  riders: number;
  my_s: number | null;
  best_s: number | null;
  avg_s: number | null;
};

export type StravaPanelPayload = {
  configured: boolean;
  isOwn: boolean;
  connected: boolean;
  riderConnected: boolean;
  segments: StravaSegmentRow[];
};

export const getStravaPanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ eventId: z.string().uuid(), entrantId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }): Promise<StravaPanelPayload> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const configured = !!process.env["STRAVA_CLIENT_ID"] && !!process.env["STRAVA_CLIENT_SECRET"];

    const { data: ee } = await supabaseAdmin
      .from("event_entrants")
      .select("id, category, entrants:entrants!inner(user_id)")
      .eq("id", data.entrantId)
      .eq("event_id", data.eventId)
      .maybeSingle();
    const riderUser = ((ee as any)?.entrants?.user_id as string | null) ?? null;
    const isOwn = !!riderUser && riderUser === context.userId;

    const { data: mine } = await supabaseAdmin
      .from("strava_connections")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    const { data: riderConn } = riderUser
      ? await supabaseAdmin.from("strava_connections").select("user_id").eq("user_id", riderUser).maybeSingle()
      : { data: null };

    const { data: efforts } = await supabaseAdmin
      .from("strava_segment_efforts")
      .select("segment_id, segment_name, distance_m, average_grade, elapsed_s, user_id, category")
      .eq("event_id", data.eventId)
      .limit(10000);

    // Best effort per user per segment.
    const bySeg = new Map<number, { name: string; d: number | null; g: number | null; users: Map<string, { s: number; cat: string | null }> }>();
    for (const e of efforts ?? []) {
      let s = bySeg.get(e.segment_id);
      if (!s) {
        s = { name: e.segment_name, d: e.distance_m as number | null, g: e.average_grade as number | null, users: new Map() };
        bySeg.set(e.segment_id, s);
      }
      const prev = s.users.get(e.user_id);
      if (!prev || e.elapsed_s < prev.s) s.users.set(e.user_id, { s: e.elapsed_s, cat: e.category });
    }

    const cat = (ee?.category as string | null) ?? null;
    const segments: StravaSegmentRow[] = [];
    for (const [id, s] of bySeg) {
      // Ignore tiny or one-off segments only if the rider isn't on them.
      const mineS = isOwn && riderUser ? s.users.get(riderUser)?.s ?? null : null;
      const peers = [...s.users.values()].filter((u) => !cat || u.cat === cat).map((u) => u.s);
      if (mineS == null && s.users.size < 2) continue;
      segments.push({
        segment_id: id,
        name: s.name,
        distance_m: s.d != null ? Number(s.d) : null,
        average_grade: s.g != null ? Number(s.g) : null,
        riders: s.users.size,
        my_s: mineS,
        best_s: peers.length ? Math.min(...peers) : null,
        avg_s: peers.length ? Math.round(peers.reduce((a, b) => a + b, 0) / peers.length) : null,
      });
    }
    segments.sort((a, b) => (b.distance_m ?? 0) - (a.distance_m ?? 0));

    return {
      configured,
      isOwn,
      connected: !!mine,
      riderConnected: !!riderConn,
      segments: segments.slice(0, 25),
    };
  });
