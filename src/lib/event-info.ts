// Client-safe types + helpers for event info blocks and chat/QA.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type PackingItem = { key: string; label: string; essential?: boolean };
export type FaqItem = { q: string; a: string };
export type EmergencyContact = { label: string; phone: string };

export type EventInfoBlock = {
  event_id: string;
  venue_address: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  map_embed_url: string | null;
  parking_notes: string | null;
  packing_list: PackingItem[];
  route_description: string | null;
  distance_km: number | null;
  elevation_m: number | null;
  gpx_url: string | null;
  rules_md: string | null;
  waivers_md: string | null;
  faqs: FaqItem[];
  emergency_contacts: EmergencyContact[];
};

function toJson<T>(value: T): Json {
  return value as unknown as Json;
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  return [];
}

export async function fetchEventInfo(eventId: string): Promise<EventInfoBlock | null> {
  const { data, error } = await supabase
    .from("event_info_blocks")
    .select("*")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) {
    console.warn("[event-info:fetch]", error);
    return null;
  }
  if (!data) return null;
  return {
    event_id: data.event_id,
    venue_address: data.venue_address,
    venue_lat: data.venue_lat as number | null,
    venue_lng: data.venue_lng as number | null,
    map_embed_url: data.map_embed_url,
    parking_notes: data.parking_notes,
    packing_list: parseJsonArray<PackingItem>(data.packing_list),
    route_description: data.route_description,
    distance_km: data.distance_km as number | null,
    elevation_m: data.elevation_m as number | null,
    gpx_url: data.gpx_url,
    rules_md: data.rules_md,
    waivers_md: data.waivers_md,
    faqs: parseJsonArray<FaqItem>(data.faqs),
    emergency_contacts: parseJsonArray<EmergencyContact>(data.emergency_contacts),
  };
}

export async function saveEventInfo(info: EventInfoBlock): Promise<boolean> {
  const { error } = await supabase.from("event_info_blocks").upsert({
    event_id: info.event_id,
    venue_address: info.venue_address,
    venue_lat: info.venue_lat,
    venue_lng: info.venue_lng,
    map_embed_url: info.map_embed_url,
    parking_notes: info.parking_notes,
    packing_list: toJson(info.packing_list),
    route_description: info.route_description,
    distance_km: info.distance_km,
    elevation_m: info.elevation_m,
    gpx_url: info.gpx_url,
    rules_md: info.rules_md,
    waivers_md: info.waivers_md,
    faqs: toJson(info.faqs),
    emergency_contacts: toJson(info.emergency_contacts),
  });
  if (error) console.warn("[event-info:save]", error);
  return !error;
}

export function emptyEventInfo(eventId: string): EventInfoBlock {
  return {
    event_id: eventId,
    venue_address: null,
    venue_lat: null,
    venue_lng: null,
    map_embed_url: null,
    parking_notes: null,
    packing_list: [],
    route_description: null,
    distance_km: null,
    elevation_m: null,
    gpx_url: null,
    rules_md: null,
    waivers_md: null,
    faqs: [],
    emergency_contacts: [],
  };
}
