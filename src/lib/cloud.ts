// Cloud read/write helpers for admin-managed content.
// Feed, promos, sponsors are backed by Lovable Cloud. Reads are anon-public;
// writes require admin RLS. Callers should fire-and-forget; failures are logged.
import { supabase } from "@/integrations/supabase/client";
import type { Batch, EntryCategory, Event, EventDay, FeedPost, Promo, ScheduleItem } from "./mock-data";
import type { Sponsor } from "./store";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);

type Row = Record<string, unknown>;

function log(err: unknown, ctx: string) {
  if (!err) return;
  console.warn(`[cloud:${ctx}]`, err);
  // Surface write failures so admins don't think a save worked when it didn't.
  const isWrite = ctx.startsWith("upsert") || ctx.startsWith("delete");
  if (!isWrite || typeof window === "undefined") return;
  const e = err as { message?: string; code?: string };
  const msg = e?.message ?? String(err);
  const permissionDenied =
    e?.code === "42501" || /row-level security|permission denied/i.test(msg);
  const hint = permissionDenied
    ? `\n\nThis usually means your admin session isn't active on this URL (Supabase sessions are per-origin). Current origin: ${window.location.origin}\n\nGo to ${window.location.origin}/auth and sign in with your admin Google account, then try again.`
    : "";
  window.alert(`Save failed (${ctx}):\n${msg}${hint}`);
}

// ---------- FEED ----------
export async function fetchFeed(): Promise<FeedPost[] | null> {
  const { data, error } = await supabase
    .from("feed_posts")
    .select("*")
    .order("pinned", { ascending: false })
    .order("posted_at", { ascending: false });
  if (error) { log(error, "fetchFeed"); return null; }
  return (data ?? []).map((r: Row) => ({
    id: String(r.id),
    externalId: null,
    type: (r.post_type as FeedPost["type"]) ?? "update",
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    author: String(r.author ?? "Race Office"),
    postedAt: String(r.posted_at ?? new Date().toISOString()),
    pinned: Boolean(r.pinned),
    eventId: (r.event_id as string | null) ?? undefined,
  }));
}
export async function upsertFeedCloud(p: FeedPost) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(p.id);
  const row = {
    ...(isUuid ? { id: p.id } : {}),
    post_type: p.type,
    title: p.title,
    body: p.body,
    author: p.author,
    posted_at: p.postedAt,
    pinned: p.pinned ?? false,
  };
  const { data, error } = await supabase.from("feed_posts").upsert(row).select().single();
  log(error, "upsertFeed");
  return data ? String((data as Row).id) : null;
}
export async function deleteFeedCloud(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const { error } = await supabase.from("feed_posts").delete().eq("id", id);
  log(error, "deleteFeed");
}

// ---------- PROMOS ----------
export async function fetchPromos(): Promise<Promo[] | null> {
  const { data, error } = await supabase.from("promos").select("*").order("created_at", { ascending: false });
  if (error) { log(error, "fetchPromos"); return null; }
  return (data ?? []).map((r: Row) => ({
    id: String(r.id),
    brand: String(r.brand ?? ""),
    title: String(r.title ?? ""),
    code: String(r.code ?? ""),
    discount: String(r.discount ?? ""),
    expires: (r.expires as string | null) ?? "",
    accent: String(r.accent ?? "oklch(0.5 0.2 25)"),
  }));
}
export async function upsertPromoCloud(p: Promo) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(p.id);
  const row = {
    ...(isUuid ? { id: p.id } : {}),
    brand: p.brand,
    title: p.title,
    code: p.code,
    discount: p.discount,
    expires: p.expires || null,
    accent: p.accent,
  };
  const { data, error } = await supabase.from("promos").upsert(row).select().single();
  log(error, "upsertPromo");
  return data ? String((data as Row).id) : null;
}
export async function deletePromoCloud(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const { error } = await supabase.from("promos").delete().eq("id", id);
  log(error, "deletePromo");
}

// ---------- SPONSORS ----------
export async function fetchSponsors(): Promise<Sponsor[] | null> {
  const { data, error } = await supabase
    .from("sponsors")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) { log(error, "fetchSponsors"); return null; }
  return (data ?? []).map((r: Row) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    tier: (r.tier as Sponsor["tier"]) ?? "Bronze",
    logoText: String(r.logo_text ?? ""),
    logoUrl: (r.logo_url as string | null) ?? undefined,
    accent: String(r.accent ?? "oklch(0.5 0.02 260)"),
    url: (r.url as string | null) ?? undefined,
    active: Boolean(r.active),
  }));
}
export async function upsertSponsorCloud(s: Sponsor) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(s.id);
  const row = {
    ...(isUuid ? { id: s.id } : {}),
    name: s.name,
    tier: s.tier,
    logo_text: s.logoText,
    logo_url: s.logoUrl ?? null,
    accent: s.accent,
    url: s.url ?? null,
    active: s.active,
  };
  const { data, error } = await supabase.from("sponsors").upsert(row).select().single();
  log(error, "upsertSponsor");
  return data ? String((data as Row).id) : null;
}
export async function deleteSponsorCloud(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const { error } = await supabase.from("sponsors").delete().eq("id", id);
  log(error, "deleteSponsor");
}

// ---------- EVENTS ----------
function eventFromRow(r: Row): Event {
  return {
    id: String(r.id),
    externalId: (r.entry_ninja_id as string | null) ?? null,
    name: String(r.name ?? ""),
    discipline: String(r.discipline ?? "Road Cycling"),
    date: String(r.event_date ?? new Date().toISOString()),
    location: String(r.location ?? ""),
    distanceKm: Number(r.distance_km ?? 0),
    status: (r.status as Event["status"]) ?? "upcoming",
    lifecycle: (r.lifecycle as Event["lifecycle"]) ?? "published",
    heroColor: String(r.hero_color ?? "from-slate-700 to-slate-900"),
    logoUrl: (r.logo_url as string | null) ?? undefined,
    coverUrl: (r.cover_url as string | null) ?? undefined,
    description: String(r.description ?? ""),
    schedule: (r.schedule as ScheduleItem[] | null) ?? [],
    mapQuery: String(r.map_query ?? ""),
    entered: false,
    classes: (r.classes as EntryCategory[] | null) ?? [],
    batches: (r.batches as Batch[] | null) ?? [],
    days: (r.days as EventDay[] | null) ?? [],
    socialLinks: ((r as Row).social_links as Event["socialLinks"]) ?? {},
  };
}

export async function fetchEvents(): Promise<Event[] | null> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });
  if (error) { log(error, "fetchEvents"); return null; }
  return (data ?? []).map((r: Row) => eventFromRow(r));
}

export async function upsertEventCloud(e: Event): Promise<string | null> {
  const row = {
    ...(isUuid(e.id) ? { id: e.id } : {}),
    name: e.name || "Untitled event",
    discipline: e.discipline,
    event_date: e.date,
    location: e.location || "",
    distance_km: e.distanceKm ?? 0,
    status: e.status,
    lifecycle: e.lifecycle ?? "published",
    entry_ninja_id: e.externalId ?? null,
    description: e.description ?? "",
    hero_color: e.heroColor,
    logo_url: e.logoUrl ?? null,
    cover_url: e.coverUrl ?? null,
    schedule: e.schedule ?? [],
    map_query: e.mapQuery ?? "",
    classes: e.classes ?? [],
    batches: e.batches ?? [],
    days: e.days ?? [],
    social_links: e.socialLinks ?? {},
  };
  const { data, error } = await supabase.from("events").upsert(row).select().single();
  log(error, "upsertEvent");
  return data ? String((data as Row).id) : null;
}

export async function deleteEventCloud(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("events").delete().eq("id", id);
  log(error, "deleteEvent");
}
