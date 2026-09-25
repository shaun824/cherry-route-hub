// Infrastructure rental jobs: private client pages reached by a secret link.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function newToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin");
  if (!data?.length) throw new Error("Forbidden");
}

/** Admin: current client link token (created on first request). */
export const getRentalShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ eventId: z.string().uuid(), reset: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = context.supabase as any;
    if (!data.reset) {
      const { data: row } = await sb.from("event_share_links").select("token").eq("event_id", data.eventId).maybeSingle();
      if (row?.token) return { token: row.token as string };
    }
    const token = newToken();
    const { error } = await sb
      .from("event_share_links")
      .upsert({ event_id: data.eventId, token, created_at: new Date().toISOString() }, { onConflict: "event_id" });
    if (error) throw new Error(error.message);
    return { token };
  });

export type RentalPage = {
  event: {
    id: string;
    name: string;
    description: string | null;
    location: string;
    event_date: string;
    build_date: string | null;
    breakdown_date: string | null;
    client_name: string | null;
    client_contact: string | null;
    cover_url: string | null;
    logo_url: string | null;
  };
  runSheet: { id: string; day_label: string | null; start_time: string | null; end_time: string | null; task: string; detail: string | null; location: string | null }[];
  equipment: { id: string; name: string; size_spec: string | null; qty: number | null; qty_label: string | null; category: string | null }[];
};

/** Public: the secret token is the permission — returns client-safe fields only. */
export const getRentalByToken = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(16).max(80) }).parse(d))
  .handler(async ({ data }): Promise<RentalPage | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: link } = await admin.from("event_share_links").select("event_id").eq("token", data.token).maybeSingle();
    if (!link) return null;
    const id = link.event_id as string;
    const [ev, tasks, gear] = await Promise.all([
      admin
        .from("events")
        .select("id, name, description, location, event_date, build_date, breakdown_date, client_name, client_contact, cover_url, logo_url")
        .eq("id", id)
        .maybeSingle(),
      admin
        .from("run_sheet_tasks")
        .select("id, day_label, day_index, start_time, end_time, task, detail, location, sort_order")
        .eq("event_id", id)
        .order("day_index", { ascending: true })
        .order("sort_order", { ascending: true }),
      admin
        .from("event_branding_bookings")
        .select("id, name, size_spec, qty, qty_label, category, sort_order")
        .eq("event_id", id)
        .order("sort_order", { ascending: true }),
    ]);
    if (!ev.data) return null;
    return {
      event: ev.data,
      runSheet: (tasks.data ?? []).map((t: any) => ({
        id: t.id, day_label: t.day_label, start_time: t.start_time, end_time: t.end_time, task: t.task, detail: t.detail, location: t.location,
      })),
      equipment: (gear.data ?? []).map((g: any) => ({
        id: g.id, name: g.name, size_spec: g.size_spec, qty: g.qty, qty_label: g.qty_label, category: g.category,
      })),
    };
  });
