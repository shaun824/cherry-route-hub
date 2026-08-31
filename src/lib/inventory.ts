// Event load-out: the master kit catalogue Red Cherry owns, what has been
// booked into each event, the vehicle runs that move it, and the shared
// Packed → On site → Setup → Returned progress the PE team and the crew on
// the ground both tick off.
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ types */

export type InventoryCategory =
  | "start_finish"
  | "sound"
  | "chill"
  | "marking"
  | "showers"
  | "signs"
  | "race_boards"
  | "tented_village"
  | "accommodation"
  | "waterholes"
  | "branding"
  | "extras";

export const INVENTORY_CATEGORIES: { id: InventoryCategory; label: string }[] = [
  { id: "start_finish", label: "Start / finish" },
  { id: "sound", label: "Sound equipment" },
  { id: "chill", label: "Chill zone" },
  { id: "marking", label: "Marking equipment" },
  { id: "showers", label: "Showers" },
  { id: "signs", label: "Village signs" },
  { id: "race_boards", label: "Race boards" },
  { id: "tented_village", label: "Tented village" },
  { id: "accommodation", label: "Tented accommodation" },
  { id: "waterholes", label: "Waterholes" },
  { id: "branding", label: "Branding" },
  { id: "extras", label: "Extras" },
];

export function categoryLabel(id?: string | null) {
  return INVENTORY_CATEGORIES.find((c) => c.id === id)?.label ?? "Extras";
}

export function categoryIndex(id?: string | null) {
  const i = INVENTORY_CATEGORIES.findIndex((c) => c.id === id);
  return i === -1 ? INVENTORY_CATEGORIES.length : i;
}

export const LOCATIONS: { id: string; label: string; short: string }[] = [
  { id: "pe", label: "PE store", short: "From PE" },
  { id: "ct", label: "Cape Town", short: "In CT" },
  { id: "container", label: "Container", short: "Container" },
  { id: "supplier", label: "Supplier / hired", short: "Supplier" },
  { id: "other", label: "Other", short: "Other" },
];

export function locationLabel(id?: string | null) {
  return LOCATIONS.find((l) => l.id === id)?.label ?? "Not set";
}
export function locationShort(id?: string | null) {
  return LOCATIONS.find((l) => l.id === id)?.short ?? "Location TBC";
}

/** The shared tick states, in order. */
export const LOAD_STAGES = [
  { id: "packed", label: "Packed", at: "packed_at", by: "packed_by" },
  { id: "on_site", label: "On site", at: "on_site_at", by: "on_site_by" },
  { id: "setup", label: "Setup", at: "setup_at", by: "setup_by" },
  { id: "returned", label: "Returned", at: "returned_at", by: "returned_by" },
] as const;

export type LoadStage = (typeof LOAD_STAGES)[number]["id"];

export type InventoryItem = {
  id: string;
  name: string;
  kind: string;
  category: string;
  home_location: string | null;
  size_spec: string | null;
  sponsor: string | null;
  qty_owned: number;
  notes: string | null;
  active: boolean;
};

export type LoadLine = {
  id: string;
  event_id: string;
  item_id: string | null;
  name: string;
  kind: string;
  category: string;
  location: string | null;
  size_spec: string | null;
  sponsor: string | null;
  qty: number;
  qty_label: string | null;
  placement: string | null;
  status: string;
  village_spot_id: string | null;
  department_id: string | null;
  run_id: string | null;
  notes: string | null;
  sort_order: number;
  packed_at: string | null;
  packed_by: string | null;
  on_site_at: string | null;
  on_site_by: string | null;
  setup_at: string | null;
  setup_by: string | null;
  returned_at: string | null;
  returned_by: string | null;
};

export type LogisticsRun = {
  id: string;
  event_id: string;
  run_date: string | null;
  direction: string;
  driver: string | null;
  vehicle: string | null;
  taking: string | null;
  notes: string | null;
  sort_order: number;
};

/* --------------------------------------------------------------- catalogue */

const ITEM_COLS =
  "id, name, kind, category, home_location, size_spec, sponsor, qty_owned, notes, active";
const LINE_COLS =
  "id, event_id, item_id, name, kind, category, location, size_spec, sponsor, qty, qty_label, placement, status, village_spot_id, department_id, run_id, notes, sort_order, packed_at, packed_by, on_site_at, on_site_by, setup_at, setup_by, returned_at, returned_by";
const RUN_COLS = "id, event_id, run_date, direction, driver, vehicle, taking, notes, sort_order";

export async function fetchInventoryItems(): Promise<InventoryItem[]> {
  const { data } = await supabase.from("branding_inventory").select(ITEM_COLS).order("name");
  return (data ?? []) as InventoryItem[];
}

export async function saveInventoryItem(item: Partial<InventoryItem> & { name: string }) {
  const row = {
    name: item.name.trim(),
    kind: item.kind ?? "other",
    category: item.category ?? "extras",
    home_location: item.home_location ?? null,
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

export async function deleteInventoryItem(id: string) {
  const { error } = await supabase.from("branding_inventory").delete().eq("id", id);
  if (error) throw error;
}

/* --------------------------------------------------------------- load list */

export async function fetchLoadList(eventId: string): Promise<LoadLine[]> {
  if (!eventId) return [];
  const { data } = await supabase
    .from("event_branding_bookings")
    .select(LINE_COLS)
    .eq("event_id", eventId)
    .order("sort_order")
    .order("created_at");
  const rows = (data ?? []) as LoadLine[];
  return rows.sort(
    (a, b) => categoryIndex(a.category) - categoryIndex(b.category) || a.sort_order - b.sort_order,
  );
}

export async function addLoadLine(input: {
  eventId: string;
  item?: InventoryItem | null;
  name?: string;
  kind?: string;
  category?: string;
  location?: string | null;
  sizeSpec?: string | null;
  sponsor?: string | null;
  qty: number;
  qtyLabel?: string | null;
  placement?: string | null;
  departmentId?: string | null;
  runId?: string | null;
  notes?: string | null;
  sortOrder?: number;
}) {
  const { error } = await supabase.from("event_branding_bookings").insert({
    event_id: input.eventId,
    item_id: input.item?.id ?? null,
    name: (input.name ?? input.item?.name ?? "Kit item").trim(),
    kind: input.kind ?? input.item?.kind ?? "other",
    category: input.category ?? input.item?.category ?? "extras",
    location: input.location ?? input.item?.home_location ?? null,
    size_spec: input.sizeSpec ?? input.item?.size_spec ?? null,
    sponsor: input.sponsor ?? input.item?.sponsor ?? null,
    qty: Math.max(1, input.qty || 1),
    qty_label: input.qtyLabel ?? null,
    placement: input.placement ?? null,
    department_id: input.departmentId ?? null,
    run_id: input.runId ?? null,
    notes: input.notes ?? null,
    sort_order: input.sortOrder ?? 0,
  });
  if (error) throw error;
}

export async function updateLoadLine(id: string, patch: Partial<LoadLine>) {
  const { error } = await supabase.from("event_branding_bookings").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteLoadLine(id: string) {
  const { error } = await supabase.from("event_branding_bookings").delete().eq("id", id);
  if (error) throw error;
}

/** Tick (or untick) one stage on a line, stamping who and when. */
export async function setStage(line: LoadLine, stage: LoadStage, on: boolean, userId: string | null) {
  const meta = LOAD_STAGES.find((s) => s.id === stage)!;
  const patch: Record<string, unknown> = {
    [meta.at]: on ? new Date().toISOString() : null,
    [meta.by]: on ? userId : null,
  };
  if (stage === "setup" && on) patch['status'] = "installed";
  const { error } = await supabase
    .from("event_branding_bookings")
    .update(patch as never)
    .eq("id", line.id);
  if (error) throw error;
}

export function stageDone(line: LoadLine, stage: LoadStage) {
  const meta = LOAD_STAGES.find((s) => s.id === stage)!;
  return Boolean((line as unknown as Record<string, string | null>)[meta.at]);
}

/** How far along a line is: the last stage that has been ticked. */
export function stageProgress(line: LoadLine): LoadStage | null {
  let last: LoadStage | null = null;
  for (const s of LOAD_STAGES) if (stageDone(line, s.id)) last = s.id;
  return last;
}

/* ------------------------------------------------------------------- runs */

export async function fetchRuns(eventId: string): Promise<LogisticsRun[]> {
  if (!eventId) return [];
  const { data } = await supabase
    .from("event_logistics_runs")
    .select(RUN_COLS)
    .eq("event_id", eventId)
    .order("run_date", { ascending: true })
    .order("sort_order", { ascending: true });
  return (data ?? []) as LogisticsRun[];
}

export async function saveRun(run: Partial<LogisticsRun> & { event_id: string }) {
  const row = {
    event_id: run.event_id,
    run_date: run.run_date || null,
    direction: run.direction ?? "out",
    driver: run.driver ?? null,
    vehicle: run.vehicle ?? null,
    taking: run.taking ?? null,
    notes: run.notes ?? null,
    sort_order: run.sort_order ?? 0,
  };
  if (run.id) {
    const { error } = await supabase.from("event_logistics_runs").update(row).eq("id", run.id);
    if (error) throw error;
    return run.id;
  }
  const { data, error } = await supabase
    .from("event_logistics_runs")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id as string | undefined;
}

export async function deleteRun(id: string) {
  const { error } = await supabase.from("event_logistics_runs").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------------------------------------------------------- summary */

export function groupByCategory(lines: LoadLine[]) {
  const map = new Map<string, LoadLine[]>();
  for (const l of lines) {
    const arr = map.get(l.category) ?? [];
    arr.push(l);
    map.set(l.category, arr);
  }
  return Array.from(map.entries())
    .sort((a, b) => categoryIndex(a[0]) - categoryIndex(b[0]))
    .map(([category, items]) => ({ category, label: categoryLabel(category), items }));
}

export function totalsByLocation(lines: LoadLine[]) {
  const map = new Map<string, number>();
  for (const l of lines) map.set(l.location ?? "other", (map.get(l.location ?? "other") ?? 0) + 1);
  return Array.from(map.entries())
    .map(([id, count]) => ({ id, label: locationShort(id), count }))
    .sort((a, b) => b.count - a.count);
}

/** Human quantity: the free-text label ("All") wins over the number. */
export function qtyText(l: LoadLine) {
  return l.qty_label?.trim() || String(l.qty);
}

/** One line per booking for a department's packing list. */
export function packingLine(l: LoadLine) {
  const bits = [l.size_spec, l.sponsor, locationShort(l.location)].filter(Boolean).join(" · ");
  return `${l.name}${bits ? ` (${bits})` : ""}`;
}
