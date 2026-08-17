// Browser-side reads for the crew run sheet: departments, daily tasks,
// packing lists, waivers and the crew member's own tick-off state.
import { supabase } from "@/integrations/supabase/client";

export type Department = {
  id: string;
  event_id: string;
  name: string;
  slug: string;
  lead_name: string | null;
  contact: string | null;
  overview: string | null;
  safety_notes: string | null;
  sort_order: number;
};

export type RunSheetTask = {
  id: string;
  event_id: string;
  department_id: string;
  day_label: string;
  day_index: number;
  start_time: string | null;
  end_time: string | null;
  task: string;
  detail: string | null;
  owner: string | null;
  location: string | null;
  notes: string | null;
  sort_order: number;
};

export type PackingItem = {
  id: string;
  department_id: string;
  item: string;
  qty: string | null;
  notes: string | null;
  critical: boolean;
  source: string;
  sort_order: number;
};

export const WAIVER_VERSION = "v1";

export const DEFAULT_WAIVER = `I understand that working at a Red Cherry Events event involves outdoor, physical and vehicle-adjacent activity, and that risks include injury, illness, loss or damage to property.

I confirm that I am physically able to carry out the duties of my department, that I will follow all safety instructions given by my department lead and the event safety officer, and that I will not work under the influence of alcohol or drugs.

I accept these risks voluntarily and, to the extent permitted by law, I waive any claim against Red Cherry Events, its staff, contractors, sponsors and landowners for loss, injury or damage arising from my participation, except where caused by gross negligence.

I confirm the details I have given are correct and that I will report any incident, injury or hazard immediately.`;

export async function fetchDepartments(eventId: string): Promise<Department[]> {
  const { data } = await supabase
    .from("event_departments")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });
  return (data ?? []) as Department[];
}

export async function fetchRunSheetTasks(eventId: string): Promise<RunSheetTask[]> {
  const { data } = await supabase
    .from("run_sheet_tasks")
    .select("*")
    .eq("event_id", eventId)
    .order("day_index", { ascending: true })
    .order("sort_order", { ascending: true });
  return (data ?? []) as RunSheetTask[];
}

export async function fetchPacking(departmentId: string): Promise<PackingItem[]> {
  const { data } = await supabase
    .from("department_packing_items")
    .select("*")
    .eq("department_id", departmentId)
    .order("critical", { ascending: false })
    .order("sort_order", { ascending: true });
  return (data ?? []) as PackingItem[];
}

export async function fetchMyDepartmentIds(eventId: string): Promise<string[]> {
  const { data } = await supabase
    .from("crew_department_assignments")
    .select("department_id")
    .eq("event_id", eventId);
  return ((data ?? []) as { department_id: string }[]).map((r) => r.department_id);
}

export async function fetchMyTaskState(): Promise<Record<string, boolean>> {
  const { data } = await supabase.from("crew_task_state").select("task_id, done");
  const out: Record<string, boolean> = {};
  for (const r of (data ?? []) as { task_id: string; done: boolean }[]) out[r.task_id] = r.done;
  return out;
}

export async function setTaskDone(userId: string, taskId: string, done: boolean) {
  await supabase
    .from("crew_task_state")
    .upsert(
      { user_id: userId, task_id: taskId, done, updated_at: new Date().toISOString() },
      { onConflict: "user_id,task_id" },
    );
}

export async function fetchMyWaiver(eventId: string) {
  const { data } = await supabase
    .from("crew_waivers")
    .select("id, accepted_at, full_name")
    .eq("event_id", eventId)
    .eq("waiver_version", WAIVER_VERSION)
    .maybeSingle();
  return data as { id: string; accepted_at: string; full_name: string } | null;
}

export async function acceptWaiver(opts: {
  userId: string;
  eventId: string;
  departmentId: string | null;
  fullName: string;
}) {
  const { error } = await supabase.from("crew_waivers").insert({
    user_id: opts.userId,
    event_id: opts.eventId,
    department_id: opts.departmentId,
    full_name: opts.fullName,
    waiver_version: WAIVER_VERSION,
    user_agent: typeof navigator === "undefined" ? null : navigator.userAgent.slice(0, 300),
  });
  if (error && !/duplicate key/i.test(error.message)) throw error;
}

export async function suggestPackingItem(opts: {
  userId: string;
  userName: string;
  eventId: string;
  departmentId: string;
  item: string;
  notes: string;
}) {
  const { error } = await supabase.from("packing_suggestions").insert({
    event_id: opts.eventId,
    department_id: opts.departmentId,
    item: opts.item,
    notes: opts.notes || null,
    created_by: opts.userId,
    created_by_name: opts.userName || null,
  });
  if (error) throw error;
}

/** Groups tasks into ordered days for the day tabs. */
export function groupTasksByDay(tasks: RunSheetTask[]) {
  const map = new Map<string, { key: string; label: string; index: number; tasks: RunSheetTask[] }>();
  for (const t of tasks) {
    const key = `${t.day_index}|${t.day_label}`;
    if (!map.has(key)) {
      map.set(key, { key, label: t.day_label || "Run sheet", index: t.day_index, tasks: [] });
    }
    map.get(key)!.tasks.push(t);
  }
  return [...map.values()].sort((a, b) => a.index - b.index);
}

/** Minutes past midnight for a "07:30" / "7am" style cell, or null. */
export function timeToMinutes(v: string | null): number | null {
  if (!v) return null;
  const m = v.match(/(\d{1,2})[:h.]?(\d{2})?\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = (m[3] ?? "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}
