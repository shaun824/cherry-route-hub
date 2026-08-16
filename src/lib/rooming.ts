// Accommodation ("rooming list") helpers. Admins upload a rooming list per
// venue; riders see only their own allocation (tent / room number).
import { supabase } from "@/integrations/supabase/client";
import { withSnapshot } from "@/lib/offline-pack";

export type Venue = {
  id: string;
  event_id: string;
  name: string;
  address: string | null;
  notes: string | null;
  sort_order: number;
  /** id of the village-map point where this venue sits, so crew can find it */
  village_spot_id: string | null;
  rooming_sheet_url: string | null;
  rooming_sheet_range: string | null;
  rooming_sheet_synced_at: string | null;
  rooming_sheet_error: string | null;
  rooming_sheet_rows: number | null;
};

export type RoomingRow = {
  id: string;
  event_id: string;
  venue_id: string | null;
  entrant_id: string | null;
  /** the rider's actual entry for this event (Entry Ninja), when linked */
  event_entrant_id: string | null;
  match_source: string | null;
  full_name: string;
  email: string | null;
  tent_number: string | null;
  room_type: string | null;
  notes: string | null;
  location_hint: string | null;
  /** id of the drawn village-map area this person sits in */
  village_zone_id: string | null;
  village_spot_id: string | null;
  /** id of the exact tent pin, when one has been dropped */
  village_tent_id: string | null;
  venue?: { id: string; name: string; address: string | null; village_spot_id: string | null } | null;
};

export const ROOMING_COLUMNS =
  "id, event_id, venue_id, entrant_id, event_entrant_id, match_source, full_name, email, tent_number, room_type, notes, location_hint, village_zone_id, village_spot_id, village_tent_id, venue:event_venues(id, name, address, village_spot_id)";


export async function fetchVenues(eventId: string): Promise<Venue[]> {
  const { data, error } = await supabase
    .from("event_venues")
    .select("id, event_id, name, address, notes, sort_order, village_spot_id, rooming_sheet_url, rooming_sheet_range, rooming_sheet_synced_at, rooming_sheet_error, rooming_sheet_rows")
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
  return withSnapshot(
    `rooming:${eventId}`,
    () => fetchRoomingLive(eventId),
    (v) => v.length === 0,
  );
}

async function fetchRoomingLive(eventId: string): Promise<RoomingRow[]> {
  const { data, error } = await supabase
    .from("event_rooming")
    .select(ROOMING_COLUMNS)
    .eq("event_id", eventId)
    .order("tent_number", { ascending: true });
  if (error) {
    console.warn("[rooming] list", error);
    return [];
  }
  return (data ?? []) as unknown as RoomingRow[];
}

/** The signed-in rider's own accommodation allocation for an event (RLS-scoped). */
export async function fetchMyRooming(eventId: string): Promise<RoomingRow | null> {
  return withSnapshot(`my-rooming:${eventId}`, () => fetchMyRoomingLive(eventId), (v) => v === null);
}

async function fetchMyRoomingLive(eventId: string): Promise<RoomingRow | null> {
  const rows = await fetchRooming(eventId);
  if (rows.length === 0) return null;

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  const email = auth.user?.email?.toLowerCase() ?? null;
  if (!uid) return null;

  const { data: mine } = await supabase.from("entrants").select("id").eq("user_id", uid);
  const entrantIds = new Set((mine ?? []).map((e) => e.id));

  // Entries for this event that belong to me — the strongest link.
  const myEntryIds = new Set<string>();
  if (entrantIds.size) {
    const { data: entries } = await supabase
      .from("event_entrants")
      .select("id, entrant_id")
      .eq("event_id", eventId)
      .in("entrant_id", Array.from(entrantIds));
    for (const e of entries ?? []) myEntryIds.add(e.id);
  }

  return (
    rows.find((r) => r.event_entrant_id && myEntryIds.has(r.event_entrant_id)) ??
    rows.find((r) => r.entrant_id && entrantIds.has(r.entrant_id)) ??
    rows.find((r) => email && (r.email ?? "").toLowerCase() === email) ??
    null

  );
}
