// Client helpers for the rider's own events (from the entrants roster).
import { supabase } from "@/integrations/supabase/client";

export type ExtraItem = {
  name: string;
  qty: number;
  size?: string;
  price?: number;
};

export type MyEventRow = {
  event_entrant_id: string;
  event_id: string;
  category: string | null;
  batch: string | null;
  bib_number: string | null;
  registration_ref: string | null;
  jacket_size: string | null;
  tshirt_size: string | null;
  extras: ExtraItem[];
  notes: string | null;
  paid: boolean | null;
  amount_due_cents: number | null;
  amount_paid_cents: number | null;
  event: {
    id: string;
    name: string;
    discipline: string;
    event_date: string;
    location: string;
    distance_km: number;
    status: string;
    hero_color: string | null;
    logo_url: string | null;
    description: string | null;
    social_links: Record<string, string> | null;
    title_sponsor_name: string | null;
    title_sponsor_logo_url: string | null;
    title_sponsor_url: string | null;
  };
};


function normalizeExtras(raw: unknown): ExtraItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const obj = r as Record<string, unknown>;
      const name = String(obj.name ?? "").trim();
      if (!name) return null;
      return {
        name,
        qty: Number(obj.qty ?? 1) || 1,
        size: obj.size ? String(obj.size) : undefined,
        price: obj.price != null ? Number(obj.price) : undefined,
      } as ExtraItem;
    })
    .filter((x): x is ExtraItem => x !== null);
}

export async function fetchMyEvents(): Promise<MyEventRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];

  // Only the entrant records linked to this signed-in person (admins included).
  const { data: mine, error: entrantErr } = await supabase
    .from("entrants")
    .select("id")
    .eq("user_id", uid);
  if (entrantErr) {
    console.warn("[my-events] entrants", entrantErr);
    return [];
  }
  const entrantIds = (mine ?? []).map((e) => e.id);
  if (entrantIds.length === 0) return [];

  const { data, error } = await supabase
    .from("event_entrants")
    .select(
      "id, event_id, category, batch, bib_number, registration_ref, jacket_size, tshirt_size, extras, notes, paid, amount_due_cents, amount_paid_cents, event:events(id, name, discipline, event_date, location, distance_km, status, hero_color, logo_url, description, social_links, title_sponsor_name, title_sponsor_logo_url, title_sponsor_url)",
    )
    .in("entrant_id", entrantIds)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[my-events]", error);
    return [];
  }
  const rows = (data ?? [])
    .filter((r) => r.event)
    .map((r) => ({
      event_entrant_id: r.id,
      event_id: r.event_id,
      category: r.category,
      batch: r.batch,
      bib_number: r.bib_number,
      registration_ref: (r as { registration_ref: string | null }).registration_ref ?? null,
      jacket_size: (r as { jacket_size: string | null }).jacket_size ?? null,
      tshirt_size: (r as { tshirt_size: string | null }).tshirt_size ?? null,
      extras: normalizeExtras((r as { extras: unknown }).extras),
      notes: (r as { notes: string | null }).notes ?? null,
      paid: (r as { paid: boolean | null }).paid ?? null,
      amount_due_cents: (r as { amount_due_cents: number | null }).amount_due_cents ?? null,
      amount_paid_cents: (r as { amount_paid_cents: number | null }).amount_paid_cents ?? null,
      event: r.event as MyEventRow["event"],
    }));

  // Chronological: soonest event first, then anything without a date.
  return rows.sort((a, b) => {
    const ta = a.event?.event_date ? new Date(a.event.event_date).getTime() : Number.POSITIVE_INFINITY;
    const tb = b.event?.event_date ? new Date(b.event.event_date).getTime() : Number.POSITIVE_INFINITY;
    return ta - tb;
  });
}

export async function fetchMyEventById(eventId: string): Promise<MyEventRow | null> {
  const rows = await fetchMyEvents();
  return rows.find((r) => r.event_id === eventId) ?? null;
}
