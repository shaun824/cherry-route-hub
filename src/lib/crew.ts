// Crew helpers: event staff can see the full rooming list for an event,
// who shares each tent/room, and where that room sits on the village map.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type CrewRoomingRow = {
  id: string;
  event_id: string;
  venue_id: string | null;
  full_name: string;
  email: string | null;
  tent_number: string | null;
  room_type: string | null;
  notes: string | null;
  location_hint: string | null;
  village_zone_id: string | null;
  village_spot_id: string | null;
  village_tent_id: string | null;
  event_entrant_id: string | null;
  match_source: string | null;
  entry?: {
    id: string;
    bib_number: string | null;
    registration_ref: string | null;
    category: string | null;
    batch: string | null;
  } | null;
  venue?: { id: string; name: string; address: string | null; village_spot_id: string | null } | null;
};


export type CrewEvent = { id: string; name: string; event_date: string };

/** True when the signed-in user holds the crew (or admin) role. */
export async function checkIsCrew(client: SupabaseClient<any, any, any>): Promise<boolean> {
  const { data, error } = await client.from("user_roles").select("role").in("role", ["crew", "admin"]);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

export async function fetchCrewEvents(): Promise<CrewEvent[]> {
  const { data } = await supabase
    .from("events")
    .select("id, name, event_date")
    .order("event_date", { ascending: true });
  return (data ?? []) as CrewEvent[];
}

export async function fetchCrewRooming(eventId: string): Promise<CrewRoomingRow[]> {
  const { data, error } = await supabase
    .from("event_rooming")
    .select(
      "id, event_id, venue_id, full_name, email, tent_number, room_type, notes, location_hint, village_zone_id, village_spot_id, village_tent_id, event_entrant_id, match_source, entry:event_entrants(id, bib_number, registration_ref, category, batch), venue:event_venues(id, name, address, village_spot_id)",
    )
    .eq("event_id", eventId)
    .order("full_name", { ascending: true });
  if (error) {
    console.warn("[crew] rooming", error);
    return [];
  }
  return (data ?? []) as unknown as CrewRoomingRow[];
}


export function normaliseTent(v: string | null | undefined): string {
  return (v ?? "").trim().toUpperCase();
}

/** Everyone sharing the same tent/room at the same venue. */
export function roomMates(rows: CrewRoomingRow[], row: CrewRoomingRow): CrewRoomingRow[] {
  const tent = normaliseTent(row.tent_number);
  if (!tent) return [];
  return rows.filter(
    (r) => r.id !== row.id && normaliseTent(r.tent_number) === tent && r.venue_id === row.venue_id,
  );
}

/** Plain-language "where is this room" line for crew to read out. */
export function whereIsRoom(row: CrewRoomingRow): string {
  const bits = [
    row.tent_number ? `Tent/room ${row.tent_number}` : null,
    row.room_type,
    row.venue?.name,
    row.location_hint,
    row.venue?.address,
  ].filter(Boolean);
  return bits.join(" · ");
}

export function matchesSearch(row: CrewRoomingRow, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  return [row.full_name, row.email, row.tent_number, row.room_type, row.venue?.name, row.notes]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(t));
}
