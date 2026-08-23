// Client-safe types + helpers for event info blocks and chat/QA.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type PackingItem = { key: string; label: string; essential?: boolean; category?: string };

export type PackingContext = {
  /** Number of days the rider is actually riding/racing. */
  rideDays: number;
  /** Number of nights away (0 = day event, no overnight bag). */
  nights: number;
  /** Motorbike vs pedal-bike kit. */
  sport?: "mtb" | "moto";
};

const times = (n: number) => `x${Math.max(1, n)}`;

/**
 * Build a packing list sized to the event itinerary.
 * All riders run tubeless, so no tubes are ever listed — a spare foldable tyre,
 * sealant and plugs are carried instead.
 */
export function buildPackingList(ctx: PackingContext): PackingItem[] {
  const rideDays = Math.max(1, Math.round(ctx.rideDays || 1));
  const nights = Math.max(0, Math.round(ctx.nights || 0));
  const moto = ctx.sport === "moto";
  const kitSets = Math.min(rideDays, Math.max(2, Math.ceil(rideDays / 2)));
  const items: PackingItem[] = [];

  // Riding clothes — scaled to ride days
  const rideCat = moto ? "Riding gear" : "Riding clothes";
  items.push(
    { key: "rc-helmet", label: moto ? "Helmet (with goggles)" : "Helmet", category: rideCat, essential: true },
    { key: "rc-shoes", label: moto ? "Riding boots" : "Riding shoes", category: rideCat, essential: true },
    { key: "rc-socks", label: `Socks — fresh pair per day (${times(rideDays)})`, category: rideCat },
  );
  if (moto) {
    items.push(
      { key: "rc-jersey", label: `Riding jerseys (${times(kitSets)})`, category: rideCat },
      { key: "rc-pants", label: "Riding pants", category: rideCat, essential: true },
      { key: "rc-armour", label: "Body armour / knee & elbow guards", category: rideCat, essential: true },
      { key: "rc-gloves", label: `Gloves (${times(Math.min(2, rideDays))})`, category: rideCat },
      { key: "rc-neckbrace", label: "Neck brace", category: rideCat },
    );
  } else {
    items.push(
      { key: "rc-bibs", label: `Bib shorts (${times(kitSets)}${rideDays > kitSets ? ", wash between days" : ""})`, category: rideCat, essential: true },
      { key: "rc-jersey", label: `Jerseys (${times(kitSets)})`, category: rideCat },
      { key: "rc-gloves", label: "Gloves", category: rideCat },
      { key: "rc-armwarmers", label: "Arm warmers", category: rideCat },
      { key: "rc-buffs", label: `Buffs (${times(Math.min(2, rideDays))})`, category: rideCat },
    );
  }
  items.push(
    { key: "rc-sunnies", label: moto ? "Goggles + spare lens" : "Sunglasses", category: rideCat },
    { key: "rc-rainjkt", label: "Rain jacket", category: rideCat },
    { key: "rc-warmjkt", label: "Warm jacket", category: rideCat },
  );

  // Carried on the rider
  const pocketCat = moto ? "On you / in the bum bag" : "In jersey pockets";
  items.push(
    { key: "jp-phone", label: "Cellphone (fully charged)", category: pocketCat, essential: true },
    { key: "jp-tools", label: "Tools and spares", category: pocketCat },
    { key: "jp-padkos", label: `Padkos / snacks for the day (${times(rideDays)} days)`, category: pocketCat },
    { key: "jp-lipice", label: "Lip ice SPF50", category: pocketCat },
  );

  // On the bike — tubeless setup, spare tyre instead of tubes
  const bikeCat = "Fixed to / carried on the bike";
  items.push(
    {
      key: "bk-sparetyre",
      label: "Spare foldable tyre (everyone runs tubeless — bring a tyre, not a tube)",
      category: bikeCat,
      essential: true,
    },
    { key: "bk-sealant", label: "Tubeless sealant (100ml) + spare tubeless valve", category: bikeCat, essential: true },
    { key: "bk-plugs", label: "Tyre plugs and plug tool", category: bikeCat, essential: true },
    { key: "bk-levers", label: "Tyre levers", category: bikeCat },
    { key: "bk-bombs", label: `CO₂ bombs (${times(Math.max(2, rideDays))}) and bomb valve${moto ? "" : " / mini pump"}`, category: bikeCat },
    { key: "bk-gaffer", label: "Gaffer tape", category: bikeCat },
    { key: "bk-bottles", label: moto ? "Hydration pack (2L)" : "2x 900ml bottles", category: bikeCat, essential: true },
    { key: "bk-lube", label: `Chain lube (${times(Math.max(1, Math.ceil(rideDays / 2)))})`, category: bikeCat },
    { key: "bk-cloth", label: "Cloth", category: bikeCat },
  );

  // Overnight bag — only when there are nights away
  if (nights > 0) {
    const obCat = "Overnight bag";
    items.push(
      { key: "ob-clothes", label: `Casual clothes for ${nights} night${nights > 1 ? "s" : ""} (${times(nights + 1)} sets)`, category: obCat, essential: true },
      { key: "ob-sleepingbag", label: "Sleeping bag for extra warmth", category: obCat },
      { key: "ob-hotwater", label: "Hot water bottle", category: obCat },
      { key: "ob-towel", label: "Towel", category: obCat },
      {
        key: "ob-toiletries",
        label: "Toiletries (body wash, toothbrush & paste, mosquito repellent, earplugs, SPF50)",
        category: obCat,
      },
      { key: "ob-cords", label: "Charging cords and power bank", category: obCat },
      { key: "ob-headlight", label: "Headlamp", category: obCat },
      { key: "ob-adaptor", label: "2-pin and USB adaptor", category: obCat },
      { key: "ob-plakkies", label: "Plakkies / camp shoes", category: obCat },
      { key: "ob-meds", label: `Chronic medication (${nights + 1} days' worth)`, category: obCat },
    );
  }

  // Tools and spares
  const tsCat = "Tools and spares";
  items.push(
    moto
      ? { key: "ts-levers", label: "Spare clutch and brake levers", category: tsCat, essential: true }
      : { key: "ts-hangar", label: "Derailleur hanger (NB!)", category: tsCat, essential: true },
    { key: "ts-multi", label: moto ? "Multi-tool and spanner set" : "Multi-tool and chain breaker", category: tsCat },
    { key: "ts-chainlinks", label: "Chain links", category: tsCat },
    { key: "ts-sidewall", label: "Side-wall boot (tyre casing repair)", category: tsCat },
    { key: "ts-cableties", label: "Cable ties", category: tsCat },
    { key: "ts-valve", label: "Valve stem remover", category: tsCat },
    { key: "ts-lube2", label: "Lube", category: tsCat },
    { key: "ts-brakepads", label: `Brake pads (${times(rideDays > 2 ? 2 : 1)} set${rideDays > 2 ? "s" : ""})`, category: tsCat },
  );

  // First aid
  const faCat = "First aid kit";
  items.push(
    { key: "fa-bandages", label: "Bandages and closures", category: faCat },
    { key: "fa-plasters", label: "Plasters (incl. heel plasters)", category: faCat },
    { key: "fa-opsite", label: '"Opsite" waterproof dressings (NB!)', category: faCat, essential: true },
    { key: "fa-blanket", label: "Emergency survival blanket", category: faCat },
    { key: "fa-bactroban", label: "Bactroban", category: faCat },
    { key: "fa-bettadine", label: "Bettadine", category: faCat },
    { key: "fa-panado", label: "Panado", category: faCat },
    { key: "fa-voltaren", label: "Voltaren", category: faCat },
    { key: "fa-antihist", label: "Antihistamine", category: faCat },
    { key: "fa-smecta", label: "Smecta", category: faCat },
    { key: "fa-buscopan", label: "Buscopan", category: faCat },
  );

  return items;
}

/**
 * Strip tubes out of any admin-configured list and make sure a spare tyre is
 * present instead — all riders run tubeless.
 */
export function tubelessSanitise(items: PackingItem[]): PackingItem[] {
  const cleaned = items.filter((i) => !/\btubes?\b/i.test(i.label));
  if (cleaned.length === items.length) return items;
  const hasTyre = cleaned.some((i) => /spare (foldable )?tyre/i.test(i.label));
  if (hasTyre) return cleaned;
  return [
    ...cleaned,
    {
      key: "bk-sparetyre",
      label: "Spare foldable tyre (everyone runs tubeless — bring a tyre, not a tube)",
      category: "Fixed to / carried on the bike",
      essential: true,
    },
  ];
}

/** Fallback list (3-day stage race) for contexts without itinerary data. */
export const DEFAULT_PACKING_LIST: PackingItem[] = buildPackingList({ rideDays: 3, nights: 3 });

export type FaqItem = { q: string; a: string };
export type EmergencyContact = { label: string; phone: string };

export type EventInfoBlock = {
  event_id: string;
  venue_address: string | null;
  /** Optional separate registration / check-in venue (rare: e.g. TDA Nyathi checks in at Addo Main Camp). */
  reg_venue_name: string | null;
  reg_venue_address: string | null;
  reg_venue_lat: number | null;
  reg_venue_lng: number | null;
  reg_notes: string | null;
  venue_lat: number | null;
  venue_lng: number | null;
  map_embed_url: string | null;
  parking_notes: string | null;
  packing_list: PackingItem[];
  route_description: string | null;
  /** Where the event finishes, shown on the accommodation timeline and info tab. */
  finish_location: string | null;
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
    reg_venue_name: (data as any).reg_venue_name ?? null,
    reg_venue_address: (data as any).reg_venue_address ?? null,
    reg_venue_lat: ((data as any).reg_venue_lat ?? null) as number | null,
    reg_venue_lng: ((data as any).reg_venue_lng ?? null) as number | null,
    reg_notes: (data as any).reg_notes ?? null,
    venue_lat: data.venue_lat as number | null,
    venue_lng: data.venue_lng as number | null,
    map_embed_url: data.map_embed_url,
    parking_notes: data.parking_notes,
    packing_list: parseJsonArray<PackingItem>(data.packing_list),
    route_description: data.route_description,
    finish_location: (data as any).finish_location ?? null,
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
    reg_venue_name: info.reg_venue_name,
    reg_venue_address: info.reg_venue_address,
    reg_venue_lat: info.reg_venue_lat,
    reg_venue_lng: info.reg_venue_lng,
    reg_notes: info.reg_notes,
    venue_lat: info.venue_lat,
    venue_lng: info.venue_lng,
    map_embed_url: info.map_embed_url,
    parking_notes: info.parking_notes,
    packing_list: toJson(info.packing_list),
    route_description: info.route_description,
    finish_location: info.finish_location,
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
    reg_venue_name: null,
    reg_venue_address: null,
    reg_venue_lat: null,
    reg_venue_lng: null,
    reg_notes: null,
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
