// Admin-only: turn a plan of action into a rental event page (draft, then apply).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkIsAdmin } from "./is-admin";
import type { RentalPlanDraft } from "./rental-plan.server";

export type { RentalPlanDraft };

export const draftRentalPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      text: z.string().max(60_000).default(""),
      mode: z.enum(["import", "edit"]).default("import"),
      attachment: z.object({ mimeType: z.string(), dataBase64: z.string().max(20_000_000), filename: z.string().nullish() }).nullish(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase))) throw new Error("Admins only");
    const { draftRentalPlan } = await import("./rental-plan.server");
    return await draftRentalPlan(data.text, data.attachment ?? null, data.mode);
  });

const draftSchema = z.object({
  name: z.string().min(1).max(200),
  client_name: z.string().nullable(),
  client_contact: z.string().nullable(),
  location: z.string().nullable(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  build_date: z.string().nullable(),
  breakdown_date: z.string().nullable(),
  description: z.string(),
  runSheet: z.array(z.object({ day_label: z.string(), start_time: z.string().nullable(), end_time: z.string().nullable(), task: z.string(), detail: z.string().nullable(), location: z.string().nullable() })).max(200),
  equipment: z.array(z.object({ name: z.string(), qty: z.number().nullable(), qty_label: z.string().nullable(), size_spec: z.string().nullable() })).max(200),
});

/** Create a new rental (eventId omitted) or update one; replaces its run sheet and equipment list. */
export const applyRentalPlanFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid().nullish(), draft: draftSchema }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase))) throw new Error("Admins only");
    const sb = context.supabase as any;
    const p = data.draft;
    const row = {
      name: p.name, client_name: p.client_name, client_contact: p.client_contact, location: p.location ?? "",
      event_date: new Date(p.event_date + "T08:00:00+02:00").toISOString(),
      build_date: p.build_date, breakdown_date: p.breakdown_date, description: p.description || null,
      event_type: "rental", discipline: "Infrastructure",
    };
    let eventId = data.eventId ?? null;
    if (eventId) {
      const { error } = await sb.from("events").update(row).eq("id", eventId).eq("event_type", "rental");
      if (error) throw new Error(error.message);
    } else {
      const { data: ins, error } = await sb.from("events").insert({ ...row, is_public: false }).select("id").single();
      if (error) throw new Error(error.message);
      eventId = ins.id as string;
    }

    // Run sheet goes under the event's first department (created if none).
    let { data: dept } = await sb.from("event_departments").select("id").eq("event_id", eventId).order("sort_order").limit(1).maybeSingle();
    if (!dept) {
      const r = await sb.from("event_departments").insert({ event_id: eventId, name: "Build & Strike", slug: "build-strike", sort_order: 0 }).select("id").single();
      if (r.error) throw new Error(r.error.message);
      dept = r.data;
    }
    await sb.from("run_sheet_tasks").delete().eq("event_id", eventId);
    const dayOrder: string[] = [];
    for (const t of p.runSheet) if (!dayOrder.includes(t.day_label)) dayOrder.push(t.day_label);
    if (p.runSheet.length) {
      const { error } = await sb.from("run_sheet_tasks").insert(
        p.runSheet.map((t, i) => ({
          event_id: eventId, department_id: dept.id, day_label: t.day_label, day_index: dayOrder.indexOf(t.day_label),
          start_time: t.start_time, end_time: t.end_time, task: t.task, detail: t.detail, location: t.location, sort_order: i,
        })),
      );
      if (error) throw new Error(error.message);
    }

    await sb.from("event_branding_bookings").delete().eq("event_id", eventId).eq("category", "infrastructure");
    if (p.equipment.length) {
      const { error } = await sb.from("event_branding_bookings").insert(
        p.equipment.map((g, i) => ({
          event_id: eventId, name: g.name, qty: g.qty ?? 1, qty_label: g.qty_label, size_spec: g.size_spec,
          category: "infrastructure", kind: "other", sort_order: i, created_by: context.userId,
        })),
      );
      if (error) throw new Error(error.message);
    }
    return { eventId: eventId! };
  });

const sastDate = (iso: string | null) =>
  iso ? new Date(new Date(iso).getTime() + 2 * 3600_000).toISOString().slice(0, 10) : "";
const hm = (t: string | null) => (t ? String(t).slice(0, 5) : "");

/** Build an editable raw-text plan (with headings) from what is live on the rental page now. */
export const getLivePlanTextFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await checkIsAdmin(context.supabase))) throw new Error("Admins only");
    const sb = context.supabase as any;
    const { data: ev, error } = await sb.from("events")
      .select("name, client_name, client_contact, location, event_date, build_date, breakdown_date, description")
      .eq("id", data.eventId).eq("event_type", "rental").maybeSingle();
    if (error) throw new Error(error.message);
    if (!ev) throw new Error("Rental not found.");
    const [{ data: tasks }, { data: gear }] = await Promise.all([
      sb.from("run_sheet_tasks").select("day_label, day_index, start_time, end_time, task, detail, location, sort_order")
        .eq("event_id", data.eventId).order("day_index").order("sort_order"),
      sb.from("event_branding_bookings").select("name, qty, qty_label, size_spec, sort_order")
        .eq("event_id", data.eventId).eq("category", "infrastructure").order("sort_order"),
    ]);
    const L: string[] = [
      "# EVENT DETAILS",
      `Event name: ${ev.name ?? ""}`,
      `Client: ${ev.client_name ?? ""}`,
      `Client contact: ${ev.client_contact ?? ""}`,
      `Venue: ${ev.location ?? ""}`,
      `Build date: ${ev.build_date ?? ""}`,
      `Event date (guests arrive): ${sastDate(ev.event_date)}`,
      `Breakdown date: ${ev.breakdown_date ?? ""}`,
      "",
      "# CLIENT DESCRIPTION",
      (ev.description ?? "").trim(),
      "",
      "# RUN SHEET",
      "(One task per line: time – time | task | detail | location. Leave times blank if unknown.)",
    ];
    let day = "";
    for (const t of tasks ?? []) {
      if (t.day_label !== day) { day = t.day_label; L.push("", `## ${day}`); }
      const time = [hm(t.start_time), hm(t.end_time)].filter(Boolean).join(" – ");
      L.push(`- ${[time, t.task, t.detail ?? "", t.location ?? ""].join(" | ").replace(/( \| )+$/, "")}`);
    }
    L.push("", "# EQUIPMENT", "(One item per line: quantity unit × item (size/spec))");
    for (const g of gear ?? []) {
      L.push(`- ${[g.qty ?? "", g.qty_label ?? ""].join(" ").trim()} × ${g.name}${g.size_spec ? ` (${g.size_spec})` : ""}`);
    }
    L.push("", "# EXTRA NOTES FOR THE AI", "(Add any new information here — it will be worked into the page.)", "");
    return { text: L.join("\n") };
  });
