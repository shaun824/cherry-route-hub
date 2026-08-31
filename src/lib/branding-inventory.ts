// Branding inventory: the catalogue of branding kit we own, and what has been
// booked into each event. Bookings flow through to the village build map
// (branding layer) and into the branding team's packing list.
import { supabase } from "@/integrations/supabase/client";

export type BrandingKind =
  | "flag"
  | "banner"
  | "arch"
  | "wall"
  | "gazebo"
  | "signage"
  | "vehicle"
  | "other";

export const BRANDING_KINDS: { id: BrandingKind; label: string }[] = [
  { id: "flag", label: "Feather / bow flag" },
  { id: "banner", label: "Banner / A-frame" },
  { id: "arch", label: "Inflatable arch" },
  { id: "wall", label: "Media / step-and-repeat wall" },
  { id: "gazebo", label: "Branded gazebo" },
  { id: "signage", label: "Signage board" },
  { id: "vehicle", label: "Vehicle branding" },
  { id: "other", label: "Other" },
];

export function brandingKindLabel(kind?: string | null) {
  return BRANDING_KINDS.find((k) => k.id === kind)?.label ?? "Other";
}

export type BrandingStatus = "booked" | "placed" | "installed";

export const BRANDING_STATUSES: { id: BrandingStatus; label: string; blurb: string }[] = [
  { id: "booked", label: "Booked", blurb: "Booked into the event, not yet on the map." },
  { id: "placed", label: "On the map", blurb: "Positioned on the village build map." },
  { id: "installed", label: "Installed", blurb: "Up on site." },
];

export type BrandingItem = {
  id: string;
  name: string;
  kind: string;
  size_spec: string | null;
  sponsor: string | null;
  qty_owned: number;
  notes: string | null;
  active: boolean;
};

export type BrandingBooking = {
  id: string;
  event_id: string;
  item_id: string | null;
  name: string;
  kind: string;
  size_spec: string | null;
  sponsor: string | null;
  qty: number;
  placement: string | null;
  status: string;
  village_spot_id: string | null;
  department_id: string | null;
  notes: string | null;
};

const ITEM_COLS = "id, name, kind, size_spec, sponsor, qty_owned, notes, active";
const BOOKING_COLS =
  "id, event_id, item_id, name, kind, size_spec, sponsor, qty, placement, status, village_spot_id, department_id, notes";

export async function fetchBrandingItems(): Promise<BrandingItem[]> {
  const { data } = await supabase
    .from("branding_inventory")
    .select(ITEM_COLS)
    .order("name");
  return (data ?? []) as BrandingItem[];
}

export async function saveBrandingItem(item: Partial<BrandingItem> & { name: string }) {
  const row = {
    name: item.name.trim(),
    kind: item.kind ?? "other",
    size_spec: item.size_spec ?? null,
    sponsor: item.sponsor ?? null,
    qty_owned: item.qty_owned ?? 0,
    notes: item.notes ?? null,
    active: item.active ?? true,
  };
  if (item.id) {
    const { error } = await supabase.from("branding_inventory").update(row).eq("id", item.id);
    if (error) throw error;
    return item.id;
  }
  const { data, error } = await supabase
    .from("branding_inventory")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id as string | undefined;
}

export async function deleteBrandingItem(id: string) {
  const { error } = await supabase.from("branding_inventory").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchBrandingBookings(eventId: string): Promise<BrandingBooking[]> {
  if (!eventId) return [];
  const { data } = await supabase
    .from("event_branding_bookings")
    .select(BOOKING_COLS)
    .eq("event_id", eventId)
    .order("created_at");
  return (data ?? []) as BrandingBooking[];
}

export async function bookBranding(input: {
  eventId: string;
  item?: BrandingItem | null;
  name?: string;
  kind?: string;
  sizeSpec?: string | null;
  sponsor?: string | null;
  qty: number;
  placement?: string | null;
  departmentId?: string | null;
  notes?: string | null;
}) {
  const { error } = await supabase.from("event_branding_bookings").insert({
    event_id: input.eventId,
    item_id: input.item?.id ?? null,
    name: (input.name ?? input.item?.name ?? "Branding item").trim(),
    kind: input.kind ?? input.item?.kind ?? "other",
    size_spec: input.sizeSpec ?? input.item?.size_spec ?? null,
    sponsor: input.sponsor ?? input.item?.sponsor ?? null,
    qty: Math.max(1, input.qty || 1),
    placement: input.placement ?? null,
    department_id: input.departmentId ?? null,
    notes: input.notes ?? null,
  });
  if (error) throw error;
}

export async function updateBooking(id: string, patch: Partial<BrandingBooking>) {
  const { error } = await supabase.from("event_branding_bookings").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteBooking(id: string) {
  const { error } = await supabase.from("event_branding_bookings").delete().eq("id", id);
  if (error) throw error;
}

/** One line per booking for the branding team's packing list. */
export function packingLine(b: BrandingBooking) {
  const bits = [b.size_spec, b.sponsor].filter(Boolean).join(" · ");
  return `${b.name}${bits ? ` (${bits})` : ""}`;
}

/** Totals by kind, for a quick "what goes on the truck" summary. */
export function totalsByKind(bookings: BrandingBooking[]) {
  const map = new Map<string, number>();
  for (const b of bookings) map.set(b.kind, (map.get(b.kind) ?? 0) + (b.qty || 0));
  return Array.from(map.entries())
    .map(([kind, qty]) => ({ kind, label: brandingKindLabel(kind), qty }))
    .sort((a, b) => b.qty - a.qty);
}
