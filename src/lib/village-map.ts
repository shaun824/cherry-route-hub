// Client-safe types + helpers for the interactive village map per event.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

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
  | "other";

export type VillageHotspot = {
  id: string;
  /** percentage of image width (0-100) */
  x: number;
  /** percentage of image height (0-100) */
  y: number;
  title: string;
  category: VillageCategory;
  description?: string;
  hours?: string;
};

export type VillageMap = {
  event_id: string;
  image_url: string | null;
  intro: string | null;
  hotspots: VillageHotspot[];
};

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
  { id: "other", label: "Other", color: "#334155" },
];

export function categoryMeta(id: VillageCategory) {
  return VILLAGE_CATEGORIES.find((c) => c.id === id) ?? VILLAGE_CATEGORIES[VILLAGE_CATEGORIES.length - 1];
}

export function emptyVillageMap(eventId: string): VillageMap {
  return { event_id: eventId, image_url: null, intro: null, hotspots: [] };
}

export async function fetchVillageMap(eventId: string): Promise<VillageMap | null> {
  const { data, error } = await supabase
    .from("event_village_maps")
    .select("event_id, image_url, intro, hotspots")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) {
    console.warn("[village-map:fetch]", error);
    return null;
  }
  if (!data) return null;
  const raw = Array.isArray(data.hotspots) ? (data.hotspots as unknown as VillageHotspot[]) : [];
  return {
    event_id: data.event_id,
    image_url: data.image_url,
    intro: data.intro,
    hotspots: raw.filter((h) => h && typeof h.x === "number" && typeof h.y === "number"),
  };
}

export async function saveVillageMap(map: VillageMap): Promise<boolean> {
  const { error } = await supabase.from("event_village_maps").upsert({
    event_id: map.event_id,
    image_url: map.image_url,
    intro: map.intro,
    hotspots: map.hotspots as unknown as Json,
  });
  if (error) console.warn("[village-map:save]", error);
  return !error;
}
