// Tent pins: optional precise points inside a drawn village area, plus bulk
// rules ("tents 1-40 sit in Nyathi camp") so a whole block can be placed at once.
import { supabase } from "@/integrations/supabase/client";
import { labelsMatch, normaliseLabel } from "@/lib/rooming-import";
import { withSnapshot } from "@/lib/offline-pack";

export type VillageTent = {
  id: string;
  event_id: string;
  label: string;
  lat: number;
  lng: number;
  zone_id: string | null;
  capacity: number | null;
  notes: string | null;
};

export type TentRule = {
  id: string;
  event_id: string;
  zone_id: string;
  /** "1-40", "A*", "Nyathi*" — matched against the tent number */
  pattern: string;
};

export async function fetchVillageTents(eventId: string): Promise<VillageTent[]> {
  if (!eventId) return [];
  return withSnapshot(
    `village-tents:${eventId}`,
    () => fetchVillageTentsLive(eventId),
    (v) => v.length === 0,
  );
}

async function fetchVillageTentsLive(eventId: string): Promise<VillageTent[]> {
  const { data, error } = await supabase
    .from("event_village_tents")
    .select("id, event_id, label, lat, lng, zone_id, capacity, notes")
    .eq("event_id", eventId)
    .order("label", { ascending: true });
  if (error) {
    console.warn("[village] tents", error);
    return [];
  }
  return (data ?? []) as VillageTent[];
}

export async function fetchTentRules(eventId: string): Promise<TentRule[]> {
  if (!eventId) return [];
  const { data, error } = await supabase
    .from("event_village_tent_rules")
    .select("id, event_id, zone_id, pattern")
    .eq("event_id", eventId);
  if (error) {
    console.warn("[village] tent rules", error);
    return [];
  }
  return (data ?? []) as TentRule[];
}

/** The tent pin whose label matches this tent/room number, if any. */
export function tentForLabel<T extends { label: string }>(
  tents: T[],
  tentNumber: string | null | undefined,
): T | null {
  if (!tentNumber) return null;
  return tents.find((t) => labelsMatch(t.label, tentNumber)) ?? null;
}

/** Does a bulk rule ("1-40", "A*", "Nyathi*") cover this tent number? */
export function ruleMatches(pattern: string, tentNumber: string | null | undefined): boolean {
  const tent = (tentNumber ?? "").trim();
  if (!tent || !pattern.trim()) return false;
  const p = pattern.trim();

  const range = p.match(/^(\d+)\s*[-–]\s*(\d+)$/);
  if (range) {
    const n = Number(tent.match(/\d+/)?.[0] ?? NaN);
    if (!Number.isFinite(n)) return false;
    const lo = Number(range[1]);
    const hi = Number(range[2]);
    return n >= Math.min(lo, hi) && n <= Math.max(lo, hi);
  }

  if (p.includes("*")) {
    const rx = new RegExp(
      `^${normaliseLabel(p).split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`,
    );
    return rx.test(normaliseLabel(tent));
  }

  return labelsMatch(p, tent);
}

/** Zone chosen by the first matching bulk rule. */
export function zoneFromRules(rules: TentRule[], tentNumber: string | null | undefined): string | null {
  return rules.find((r) => ruleMatches(r.pattern, tentNumber))?.zone_id ?? null;
}
