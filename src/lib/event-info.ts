// Client-safe types + helpers for event info blocks and chat/QA.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type PackingItem = { key: string; label: string; essential?: boolean; category?: string };

// Default packing list for multi-day cycling stage races (Tour de Addo style).
// Used when an event has no custom packing list configured.
export const DEFAULT_PACKING_LIST: PackingItem[] = [
  // Riding clothes
  { key: "rc-shoes", label: "Shoes", category: "Riding clothes", essential: true },
  { key: "rc-socks", label: "Socks (fresh pair per day x4)", category: "Riding clothes" },
  { key: "rc-bibs", label: "Bib shorts (x2, wash twice)", category: "Riding clothes", essential: true },
  { key: "rc-shorts", label: "Ride shorts", category: "Riding clothes" },
  { key: "rc-jersey", label: "Jersey", category: "Riding clothes" },
  { key: "rc-armwarmers", label: "Arm warmers", category: "Riding clothes" },
  { key: "rc-gloves", label: "Gloves", category: "Riding clothes" },
  { key: "rc-buffs", label: "2x buffs", category: "Riding clothes" },
  { key: "rc-sunnies", label: "Sunglasses", category: "Riding clothes" },
  { key: "rc-rainjkt", label: "Rain jacket", category: "Riding clothes" },
  { key: "rc-warmjkt", label: "Warm jacket", category: "Riding clothes" },
  { key: "rc-helmet", label: "Helmet", category: "Riding clothes", essential: true },
  // Jersey pockets
  { key: "jp-phone", label: "Cellphone", category: "In jersey pockets", essential: true },
  { key: "jp-tools", label: "Tools and spares", category: "In jersey pockets" },
  { key: "jp-padkos", label: "Padkos", category: "In jersey pockets" },
  { key: "jp-lipice", label: "Lip ice SPF50", category: "In jersey pockets" },
  // Fixed to / carried on bike
  { key: "bk-tube", label: "Spare tube", category: "Fixed to / carried on bike", essential: true },
  { key: "bk-gaffer", label: "Gaffer tape", category: "Fixed to / carried on bike" },
  { key: "bk-bottles", label: "2x 900ml bottles", category: "Fixed to / carried on bike", essential: true },
  { key: "bk-bombs", label: "3x CO₂ bombs", category: "Fixed to / carried on bike" },
  { key: "bk-lube", label: "2x chain lube", category: "Fixed to / carried on bike" },
  { key: "bk-levers", label: "Tyre levers", category: "Fixed to / carried on bike" },
  { key: "bk-cloth", label: "Cloth", category: "Fixed to / carried on bike" },
  // Overnight bag
  { key: "ob-clothes", label: "Spare clothing", category: "Overnight bag" },
  { key: "ob-sleepingbag", label: "Sleeping bag for extra warmth", category: "Overnight bag" },
  { key: "ob-hotwater", label: "Hot water bottle", category: "Overnight bag" },
  { key: "ob-towel", label: "Towel", category: "Overnight bag" },
  { key: "ob-toiletries", label: "Toiletries (body wash, toothbrush & paste, mosquito repellent, earplugs, SPF50)", category: "Overnight bag" },
  { key: "ob-cords", label: "Lightning and mini-USB cords", category: "Overnight bag" },
  { key: "ob-headlight", label: "Headlight", category: "Overnight bag" },
  { key: "ob-adaptor", label: "2-pin and USB adaptor", category: "Overnight bag" },
  { key: "ob-plakkies", label: "Plakkies", category: "Overnight bag" },
  // Tools & spares
  { key: "ts-hangar", label: "Derailleur hangar (NB!)", category: "Tools and spares", essential: true },
  { key: "ts-multi", label: "Multi-tool and chain breaker", category: "Tools and spares" },
  { key: "ts-chainlinks", label: "Chain links", category: "Tools and spares" },
  { key: "ts-plugs", label: "Tyre plugs", category: "Tools and spares" },
  { key: "ts-cableties", label: "Cable ties", category: "Tools and spares" },
  { key: "ts-valve", label: "Valve stem remover", category: "Tools and spares" },
  { key: "ts-sidewall", label: "Side-wall boot", category: "Tools and spares" },
  { key: "ts-lube2", label: "Lube", category: "Tools and spares" },
  { key: "ts-bombs2", label: "CO₂ bombs and bomb valve", category: "Tools and spares" },
  { key: "ts-brakepads", label: "2x brake pads", category: "Tools and spares" },
  // First aid
  { key: "fa-bandages", label: "Bandages and closures", category: "First aid kit" },
  { key: "fa-plasters", label: "Plasters (incl. heel plasters)", category: "First aid kit" },
  { key: "fa-opsite", label: "\"Opsite\" waterproof dressings (NB!)", category: "First aid kit", essential: true },
  { key: "fa-blanket", label: "Emergency survival blanket", category: "First aid kit" },
  { key: "fa-bactroban", label: "Bactroban", category: "First aid kit" },
  { key: "fa-bettadine", label: "Bettadine", category: "First aid kit" },
  { key: "fa-panado", label: "Panado", category: "First aid kit" },
  { key: "fa-voltaren", label: "Voltaren", category: "First aid kit" },
  { key: "fa-antihist", label: "Antihistamine", category: "First aid kit" },
  { key: "fa-smecta", label: "Smecta", category: "First aid kit" },
  { key: "fa-buscopan", label: "Buscopan", category: "First aid kit" },
];
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
