// Client-safe types + helpers for the interactive village map per event.
import { supabase } from "@/integrations/supabase/client";
import { withSnapshot } from "@/lib/offline-pack";
import type { Json } from "@/integrations/supabase/types";
import { guessVillageIcon } from "@/lib/village-icons";
import type { VillageZone } from "@/lib/village-zones";

export type VillageCategory =
  | "registration"
  | "food"
  | "bar"
  | "camping"
  | "parking"
  | "medical"
  | "bike"
  | "stage"
  | "toilets"
  | "shop"
  | "start"
  | "finish"
  | "other"
  // build layers (crew + admin only)
  | "power"
  | "water"
  | "fencing"
  | "structure"
  | "signage"
  | "branding";

/** Which audience a point belongs to. Absent = rider-facing (legacy data). */
export type VillageLayer = "rider" | "infra" | "branding";

export const VILLAGE_LAYERS: { id: VillageLayer; label: string; blurb: string }[] = [
  { id: "rider", label: "Rider points", blurb: "What riders and spectators see." },
  { id: "infra", label: "Infrastructure", blurb: "Power, water, fencing, structures." },
  { id: "branding", label: "Branding", blurb: "Flags, banners, signage, arches." },
];

/** Categories that only make sense on a build layer. */
export const BUILD_CATEGORIES: Record<VillageLayer, VillageCategory[]> = {
  rider: [
    "registration", "start", "finish", "food", "bar", "camping", "parking",
    "medical", "bike", "stage", "toilets", "shop", "other",
  ],
  infra: ["power", "water", "fencing", "structure", "other"],
  branding: ["branding", "signage", "other"],
};

export type VillageHotspot = {
  id: string;
  /** percentage of image width (0-100) — used for image-based plans */
  x: number;
  /** percentage of image height (0-100) — used for image-based plans */
  y: number;
  /** real-world position — used for image-free maps pinned straight on satellite */
  lat?: number;
  lng?: number;
  title: string;
  category: VillageCategory;
  description?: string;
  hours?: string;
  /** icon id from VILLAGE_ICONS — auto-guessed from the title unless overridden */
  icon?: string;
  /** hex colour override for the pin */
  color?: string;
  /** rider / infrastructure / branding — absent means rider-facing */
  layer?: VillageLayer;
  /** quantity + size for build items, e.g. "3 × 3m gazebo", "60kVA" */
  spec?: string;
};

/** Layer a point belongs to, defaulting legacy points to the rider layer. */
export function spotLayer(s: VillageHotspot): VillageLayer {
  return s.layer ?? "rider";
}

export function isBuildSpot(s: VillageHotspot): boolean {
  return spotLayer(s) !== "rider";
}


/** Real-world placement of the plan image, so live GPS can be shown on it. */
export type VillageGeo = {
  /** centre of the image / village */
  lat: number;
  lng: number;
  /** real-world width the image covers, in metres */
  widthM: number;
  /** clockwise rotation of the image in degrees */
  rotation?: number;
};

export type VillageMap = {
  /** row id — present once the village has been saved */
  id?: string;
  event_id: string;
  /** which venue this village belongs to; null = the event's main village */
  venue_id: string | null;
  image_url: string | null;
  intro: string | null;
  hotspots: VillageHotspot[];
  geo: VillageGeo | null;
  /** drawn areas used for field layout planning */
  zones: VillageZone[];
};


export function isPlacedGeo(geo: VillageGeo | null | undefined): geo is VillageGeo {
  return !!geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lng) && (geo.widthM ?? 0) > 0;
}

/** A usable village centre (no image needed). */
export function hasVenueCentre(geo: VillageGeo | null | undefined): geo is VillageGeo {
  return !!geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lng) && (geo.lat !== 0 || geo.lng !== 0);
}

export function isPinnedSpot(s: VillageHotspot): boolean {
  return Number.isFinite(s.lat) && Number.isFinite(s.lng);
}

/** Pull lat/lng out of most Google Maps link shapes. */
export function parseLatLngFromUrl(url: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /ll=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /destination=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/,
  ];
  for (const rx of patterns) {
    const m = url.match(rx);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  }
  return null;
}

/** Master key: the Weekend Warrior village layout, used to seed a new event. */
export const VILLAGE_TEMPLATE: { title: string; category: VillageCategory; description?: string }[] = [
  { title: "Registration", category: "registration", description: "Collect your race pack and board number." },
  { title: "Start Line", category: "start", description: "Race start chute and batch pens." },
  { title: "Finish Line", category: "finish", description: "Race finish gantry." },
  { title: "Day Riders & Tent Users Parking", category: "parking", description: "Parking for day riders and anyone staying in the tented village." },
  { title: "Truck Stop", category: "parking", description: "Truck and trailer drop-off zone." },
  { title: "Tented Village", category: "camping", description: "Pre-pitched tents for riders on the tented village package." },
  { title: "Own Tent Area", category: "camping", description: "Pitch your own tent in this area." },
  { title: "Showers & Toilets", category: "toilets", description: "Main ablution block with hot showers and toilets." },
  { title: "Toilets", category: "toilets", description: "Additional toilets near the chill zone." },
  { title: "Bike Setup & Tech Support", category: "bike", description: "Bike setup, spares and mechanical support." },
  { title: "Bike Wash", category: "bike", description: "Wash your bike down after each stage." },
  { title: "E-Bike Charging", category: "bike", description: "Secure e-bike battery charging." },
  { title: "Charging Station", category: "other", description: "Charge your devices and batteries here." },
  { title: "Coffee Bar", category: "food", description: "Coffee and light refreshments." },
  { title: "Food Vendors", category: "food", description: "Food trucks and vendor stalls." },
  { title: "Bar & Food", category: "bar", description: "Indoor bar and food service." },
  { title: "Chill Zone & Beer Garden", category: "bar", description: "Relax with a cold one after your ride." },
  { title: "Expo / Demo Area", category: "stage", description: "Vehicle and product demo area." },
  { title: "Merch Store", category: "shop", description: "Event merchandise and partner stands." },
  { title: "Medical", category: "medical", description: "Race medics and first aid." },
  { title: "Media Center", category: "other", description: "Media centre and event office." },
];

/** Lays template points out on a small grid around the venue centre so they can be dragged apart. */
export function templateSpots(centre: { lat: number; lng: number }): VillageHotspot[] {
  const cols = 5;
  const stepM = 45;
  return VILLAGE_TEMPLATE.map((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const east = (col - (cols - 1) / 2) * stepM;
    const north = ((Math.ceil(VILLAGE_TEMPLATE.length / cols) - 1) / 2 - row) * stepM;
    const lat = centre.lat + north / 111320;
    const lng = centre.lng + east / (111320 * Math.cos((centre.lat * Math.PI) / 180));
    return {
      id: crypto.randomUUID(),
      x: 50,
      y: 50,
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
      title: t.title,
      category: t.category,
      description: t.description,
      icon: guessVillageIcon(t.title, t.category),
    };
  });
}

/** Standard Red Cherry build kit — infrastructure and branding items crews place. */
export const BUILD_TEMPLATE: {
  title: string;
  category: VillageCategory;
  layer: VillageLayer;
  spec?: string;
  icon?: string;
}[] = [
  { title: "Main generator", category: "power", layer: "infra", spec: "1 × 60kVA", icon: "fuel" },
  { title: "Backup generator", category: "power", layer: "infra", spec: "1 × 20kVA", icon: "fuel" },
  { title: "Distro board", category: "power", layer: "infra", spec: "2 × 63A distro", icon: "plug-zap" },
  { title: "Lighting tower", category: "power", layer: "infra", spec: "2 × 4-head tower", icon: "sun" },
  { title: "Cable run", category: "power", layer: "infra", spec: "100m armoured + ramps", icon: "zap" },
  { title: "Water point", category: "water", layer: "infra", spec: "1 × 5 000L jojo", icon: "droplets" },
  { title: "Fence line", category: "fencing", layer: "infra", spec: "50m crowd barrier", icon: "land-plot" },
  { title: "Marquee", category: "structure", layer: "infra", spec: "1 × 9m × 12m", icon: "tent" },
  { title: "Gazebo", category: "structure", layer: "infra", spec: "4 × 3m × 3m", icon: "tent" },
  { title: "Skip / waste point", category: "structure", layer: "infra", spec: "2 × 6m³ skip", icon: "package" },
  { title: "Start arch", category: "branding", layer: "branding", spec: "1 × 8m inflatable arch", icon: "trophy" },
  { title: "Finish arch", category: "branding", layer: "branding", spec: "1 × 8m inflatable arch", icon: "trophy" },
  { title: "Feather flags", category: "branding", layer: "branding", spec: "6 × 4m feather flag", icon: "flag" },
  { title: "Sponsor boards", category: "branding", layer: "branding", spec: "4 × 2.4m × 1.2m board", icon: "star" },
  { title: "Banner wall", category: "branding", layer: "branding", spec: "1 × 6m step & repeat", icon: "camera" },
  { title: "Directional signage", category: "signage", layer: "branding", spec: "8 × A1 board on stake", icon: "megaphone" },
  { title: "Parking signage", category: "signage", layer: "branding", spec: "6 × A1 board", icon: "circle-parking" },
];

/** Lays the build kit out on a grid around the venue centre, ready to drag into place. */
export function buildTemplateSpots(
  centre: { lat: number; lng: number },
  layer: VillageLayer,
): VillageHotspot[] {
  const items = BUILD_TEMPLATE.filter((t) => t.layer === layer);
  const cols = 4;
  const stepM = 35;
  return items.map((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const east = (col - (cols - 1) / 2) * stepM;
    const north = ((Math.ceil(items.length / cols) - 1) / 2 - row) * stepM;
    const lat = centre.lat + north / 111320;
    const lng = centre.lng + east / (111320 * Math.cos((centre.lat * Math.PI) / 180));
    return {
      id: crypto.randomUUID(),
      x: 50,
      y: 50,
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
      title: t.title,
      category: t.category,
      layer: t.layer,
      spec: t.spec,
      icon: t.icon ?? guessVillageIcon(t.title, t.category),
    };
  });
}


export const VILLAGE_CATEGORIES: { id: VillageCategory; label: string; color: string }[] = [
  { id: "registration", label: "Registration", color: "#e11d48" },
  { id: "start", label: "Start", color: "#16a34a" },
  { id: "finish", label: "Finish", color: "#0ea5e9" },
  { id: "food", label: "Food", color: "#f97316" },
  { id: "bar", label: "Bar", color: "#a855f7" },
  { id: "camping", label: "Camping", color: "#0d9488" },
  { id: "parking", label: "Parking", color: "#475569" },
  { id: "medical", label: "Medical", color: "#dc2626" },
  { id: "bike", label: "Bike / tech", color: "#65a30d" },
  { id: "stage", label: "Stage / expo", color: "#d946ef" },
  { id: "toilets", label: "Ablutions", color: "#0284c7" },
  { id: "shop", label: "Merch / shop", color: "#ca8a04" },
  { id: "power", label: "Power", color: "#f59e0b" },
  { id: "water", label: "Water", color: "#38bdf8" },
  { id: "fencing", label: "Fencing", color: "#78716c" },
  { id: "structure", label: "Structures", color: "#7c3aed" },
  { id: "signage", label: "Signage", color: "#059669" },
  { id: "branding", label: "Branding", color: "#be123c" },
  { id: "other", label: "Other", color: "#334155" },
];

/** Effective pin colour: per-point override, else the category colour. */
export function spotColor(spot: VillageHotspot): string {
  return spot.color || categoryMeta(spot.category).color;
}

/** Effective icon id: per-point override, else guessed from the point name. */
export function spotIcon(spot: VillageHotspot): string {
  return spot.icon || guessVillageIcon(spot.title, spot.category);
}

export function categoryMeta(id: VillageCategory) {
  return VILLAGE_CATEGORIES.find((c) => c.id === id) ?? VILLAGE_CATEGORIES[VILLAGE_CATEGORIES.length - 1];
}

export function emptyVillageMap(eventId: string, venueId: string | null = null): VillageMap {
  return { event_id: eventId, venue_id: venueId, image_url: null, intro: null, hotspots: [], geo: null, zones: [] };
}

const MAP_COLUMNS = "id, event_id, venue_id, image_url, intro, hotspots, geo, zones";

/** One village per venue. `venueId === null` is the event's main/only village. */
export async function fetchVillageMap(eventId: string, venueId: string | null = null): Promise<VillageMap | null> {
  return withSnapshot(
    `village-map:${eventId}:${venueId ?? "main"}`,
    () => fetchVillageMapLive(eventId, venueId),
    (v) => v === null,
  );
}

/** Every village belonging to an event (main village + per-venue villages). */
export async function fetchVillageMaps(eventId: string): Promise<VillageMap[]> {
  return withSnapshot(
    `village-maps:${eventId}`,
    async () => {
      const { data, error } = await supabase
        .from("event_village_maps")
        .select(MAP_COLUMNS)
        .eq("event_id", eventId);
      if (error) {
        console.warn("[village-map:fetch-all]", error);
        return [];
      }
      return (data ?? []).map(normaliseMapRow);
    },
    (v) => v.length === 0,
  );
}

function normaliseMapRow(data: Record<string, unknown>): VillageMap {
  const raw = Array.isArray(data.hotspots) ? (data.hotspots as unknown as VillageHotspot[]) : [];
  const rawGeo = data.geo as VillageGeo | null | undefined;
  const rawZones = data.zones;
  const zones = Array.isArray(rawZones)
    ? (rawZones as unknown as VillageZone[]).filter((z) => z && Array.isArray(z.points) && z.points.length > 2)
    : [];
  return {
    id: (data.id as string | undefined) ?? undefined,
    event_id: data.event_id as string,
    venue_id: (data.venue_id as string | null) ?? null,
    image_url: (data.image_url as string | null) ?? null,
    intro: (data.intro as string | null) ?? null,
    hotspots: raw
      .filter((h) => h && (Number.isFinite(h.x) || Number.isFinite(h.lat)))
      .map((h) => ({ ...h, x: Number.isFinite(h.x) ? h.x : 50, y: Number.isFinite(h.y) ? h.y : 50 })),
    geo: hasVenueCentre(rawGeo) ? { ...rawGeo, widthM: rawGeo.widthM ?? 0 } : null,
    zones,
  };
}

async function fetchVillageMapLive(eventId: string, venueId: string | null): Promise<VillageMap | null> {
  let query = supabase.from("event_village_maps").select(MAP_COLUMNS).eq("event_id", eventId);
  query = venueId ? query.eq("venue_id", venueId) : query.is("venue_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.warn("[village-map:fetch]", error);
    return null;
  }
  if (!data) {
    // Legacy villages were saved before venues existed (venue_id null). If a
    // venue-scoped village has no row yet, fall back to that legacy map so the
    // editor shows the points that riders already see.
    if (venueId) {
      const { data: legacy } = await supabase
        .from("event_village_maps")
        .select(MAP_COLUMNS)
        .eq("event_id", eventId)
        .is("venue_id", null)
        .maybeSingle();
      if (legacy) return normaliseMapRow(legacy as unknown as Record<string, unknown>);
    }
    return null;
  }
  return normaliseMapRow(data as unknown as Record<string, unknown>);
}

export async function saveVillageMap(map: VillageMap): Promise<boolean> {
  const payload = {
    event_id: map.event_id,
    venue_id: map.venue_id ?? null,
    image_url: map.image_url,
    intro: map.intro,
    hotspots: map.hotspots as unknown as Json,
    geo: (map.geo ?? {}) as unknown as Json,
    zones: (map.zones ?? []) as unknown as Json,
  };

  // The (event_id, venue_id) uniqueness is enforced with an expression index, so
  // PostgREST upsert can't target it — find the existing row ourselves.
  let existing = map.id ?? null;
  if (!existing) {
    let q = supabase.from("event_village_maps").select("id").eq("event_id", map.event_id);
    q = map.venue_id ? q.eq("venue_id", map.venue_id) : q.is("venue_id", null);
    const { data } = await q.maybeSingle();
    existing = (data as { id?: string } | null)?.id ?? null;
  }

  const { error } = existing
    ? await supabase.from("event_village_maps").update(payload).eq("id", existing)
    : await supabase.from("event_village_maps").insert(payload);
  if (error) console.warn("[village-map:save]", error);
  return !error;
}

