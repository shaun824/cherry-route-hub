// Client helpers for the rider's own events (from the entrants roster).
import { supabase } from "@/integrations/supabase/client";

export type MyEventRow = {
  event_entrant_id: string;
  event_id: string;
  category: string | null;
  batch: string | null;
  bib_number: string | null;
  event: {
    id: string;
    name: string;
    discipline: string;
    event_date: string;
    location: string;
    distance_km: number;
    status: string;
    hero_color: string | null;
    description: string | null;
  };
};

export async function fetchMyEvents(): Promise<MyEventRow[]> {
  const { data, error } = await supabase
    .from("event_entrants")
    .select(
      "id, event_id, category, batch, bib_number, event:events(id, name, discipline, event_date, location, distance_km, status, hero_color, description)",
    )
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[my-events]", error);
    return [];
  }
  return (data ?? [])
    .filter((r) => r.event)
    .map((r) => ({
      event_entrant_id: r.id,
      event_id: r.event_id,
      category: r.category,
      batch: r.batch,
      bib_number: r.bib_number,
      event: r.event as MyEventRow["event"],
    }));
}
