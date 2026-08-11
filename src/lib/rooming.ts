// Accommodation ("rooming list") helpers. Admins upload a rooming list per
// venue; riders see only their own allocation (tent / room number).
import { supabase } from "@/integrations/supabase/client";

export type Venue = {
  id: string;
  event_id: string;
  name: string;
  address: string | null;
  notes: string | null;
  sort_order: number;
};

export type RoomingRow = {
  id: string;
  event_id: string;
  venue_id: string | null;
  entrant_id: string | null;
  full_name: string;
  email: string | null;
  tent_number: string | null;
  room_type: string | null;
  notes: string | null;
  venue?: { id: string; name: string; address: string | null } | null;
};

export async function fetchVenues(eventId: string): Promise<Venue[]> {
  const { data, error } = await supabase
    .from("event_venues")
    .select("id, event_id, name, address, notes, sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.warn("[rooming] venues", error);
    return [];
  }
  return data ?? [];
}

export async function fetchRooming(eventId: string): Promise<RoomingRow[]> {
  const { data, error } = await supabase
    .from("event_rooming")
    .select(
      "id, event_id, venue_id, entrant_id, full_name, email, tent_number, room_type, notes, venue:event_venues(id, name, address)",
    )
    .eq("event_id", eventId)
    .order("tent_number", { ascending: true });
  if (error) {
    console.warn("[rooming] list", error);
    return [];
  }
  return (data ?? []) as RoomingRow[];
}

/** The signed-in rider's own accommodation allocation for an event (RLS-scoped). */
export async function fetchMyRooming(eventId: string): Promise<RoomingRow | null> {
  const rows = await fetchRooming(eventId);
  if (rows.length === 0) return null;

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  const email = auth.user?.email?.toLowerCase() ?? null;
  if (!uid) return null;

  const { data: mine } = await supabase.from("entrants").select("id").eq("user_id", uid);
  const entrantIds = new Set((mine ?? []).map((e) => e.id));

  return (
    rows.find((r) => r.entrant_id && entrantIds.has(r.entrant_id)) ??
    rows.find((r) => email && (r.email ?? "").toLowerCase() === email) ??
    null
  );
}
