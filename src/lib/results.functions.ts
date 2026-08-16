import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TrackedRider = {
  id: string;
  full_name: string;
  bib_number: string | null;
  category: string | null;
  batch: string | null;
  started_at: string | null;
  finished_at: string | null;
};

export type ResultSet = {
  id: string;
  label: string;
  kind: string;
  sort_order: number;
  imported_at: string | null;
};

export type ResultRow = {
  id: string;
  result_set_id: string;
  bib_number: string | null;
  full_name: string;
  category: string | null;
  batch: string | null;
  position: number | null;
  time_text: string | null;
  time_ms: number | null;
  gap_text: string | null;
  status: string | null;
  extras: Record<string, string>;
};

export type EventResultsPayload = {
  results_url: string | null;
  results_rider_url_template: string | null;
  results_published: boolean;
  sets: ResultSet[];
  rows: ResultRow[];
};

const EventInput = z.object({ eventId: z.string().uuid() });

/** How long before the event the rider roster unlocks. */
export const ROSTER_WINDOW_DAYS = 7;

export type RosterPayload = {
  /** "ok" = riders included; "signin" = must sign in; "locked" = too early. */
  status: "ok" | "signin" | "locked";
  /** ISO date the roster opens (7 days before the event). */
  opens_at: string | null;
  event_date: string | null;
  riders: TrackedRider[];
};

/**
 * Rider roster for an event, synced in from Entry Ninja.
 * Only released to signed-in riders, and only inside the 7-day window before
 * the event (through 3 days after it).
 */
export const getEventRiders = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => EventInput.parse(input))
  .handler(async ({ data }): Promise<RosterPayload> => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const { resolveOptionalUserId } = await import("@/lib/app-bot.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ev } = await supabaseAdmin
      .from("events")
      .select("event_date")
      .eq("id", data.eventId)
      .maybeSingle();
    const eventDate = (ev?.event_date as string | null) ?? null;
    const opensAt = eventDate
      ? new Date(new Date(eventDate).getTime() - ROSTER_WINDOW_DAYS * 86400000).toISOString()
      : null;
    const closesAt = eventDate ? new Date(eventDate).getTime() + 3 * 86400000 : null;
    const now = Date.now();
    const inWindow =
      !!opensAt && !!closesAt && now >= new Date(opensAt).getTime() && now <= closesAt;

    const userId = await resolveOptionalUserId(getRequestHeader("authorization") ?? null);
    if (!userId) return { status: "signin", opens_at: opensAt, event_date: eventDate, riders: [] };
    if (!inWindow) return { status: "locked", opens_at: opensAt, event_date: eventDate, riders: [] };

    const { data: rows, error } = await supabaseAdmin
      .from("event_entrants")
      .select(
        "id, category, batch, bib_number, started_at, finished_at, entrants:entrants!inner(full_name)",
      )
      .eq("event_id", data.eventId);
    if (error) throw new Error(error.message);
    const riders = (rows ?? [])
      .map((r: any) => ({
        id: String(r.id),
        full_name: String(r.entrants?.full_name ?? ""),
        bib_number: (r.bib_number as string | null) ?? null,
        category: (r.category as string | null) ?? null,
        batch: (r.batch as string | null) ?? null,
        started_at: (r.started_at as string | null) ?? null,
        finished_at: (r.finished_at as string | null) ?? null,
      }))
      .filter((r) => r.full_name)
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
    return { status: "ok", opens_at: opensAt, event_date: eventDate, riders };
  });


/** Public results for an event: sets + rows + external links. */
export const getEventResults = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => EventInput.parse(input))
  .handler(async ({ data }): Promise<EventResultsPayload> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ev } = await supabaseAdmin
      .from("events")
      .select("results_url, results_rider_url_template, results_published")
      .eq("id", data.eventId)
      .maybeSingle();

    const { data: sets } = await supabaseAdmin
      .from("event_result_sets")
      .select("id, label, kind, sort_order, imported_at")
      .eq("event_id", data.eventId)
      .order("sort_order", { ascending: true });

    const { data: rows } = await supabaseAdmin
      .from("event_results")
      .select(
        "id, result_set_id, bib_number, full_name, category, batch, position, time_text, time_ms, gap_text, status, extras",
      )
      .eq("event_id", data.eventId)
      .order("position", { ascending: true, nullsFirst: false })
      .limit(5000);

    return {
      results_url: (ev?.results_url as string | null) ?? null,
      results_rider_url_template: (ev?.results_rider_url_template as string | null) ?? null,
      results_published: Boolean(ev?.results_published),
      sets: (sets ?? []).map((s: any) => ({
        id: String(s.id),
        label: String(s.label),
        kind: String(s.kind ?? "stage"),
        sort_order: Number(s.sort_order ?? 0),
        imported_at: (s.imported_at as string | null) ?? null,
      })),
      rows: (rows ?? []).map((r: any) => ({
        id: String(r.id),
        result_set_id: String(r.result_set_id),
        bib_number: (r.bib_number as string | null) ?? null,
        full_name: String(r.full_name ?? ""),
        category: (r.category as string | null) ?? null,
        batch: (r.batch as string | null) ?? null,
        position: r.position == null ? null : Number(r.position),
        time_text: (r.time_text as string | null) ?? null,
        time_ms: r.time_ms == null ? null : Number(r.time_ms),
        gap_text: (r.gap_text as string | null) ?? null,
        status: (r.status as string | null) ?? null,
        extras: (r.extras as Record<string, string>) ?? {},
      })),
    };
  });

const SettingsInput = z.object({
  eventId: z.string().uuid(),
  results_url: z.string().nullable(),
  results_rider_url_template: z.string().nullable(),
  results_published: z.boolean(),
});

export const saveResultsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SettingsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/results.server");
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("events")
      .update({
        results_url: data.results_url || null,
        results_rider_url_template: data.results_rider_url_template || null,
        results_published: data.results_published,
      })
      .eq("id", data.eventId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ImportInput = z.object({
  eventId: z.string().uuid(),
  label: z.string().min(1),
  kind: z.string().default("stage"),
  sortOrder: z.number().default(0),
  columnMap: z.record(z.string(), z.string()),
  rows: z.array(z.record(z.string(), z.string())).max(5000),
  mode: z.enum(["replace", "append"]).default("replace"),
});

export const importEventResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImportInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin, buildResultRows } = await import("@/lib/results.server");
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("event_result_sets")
      .select("id")
      .eq("event_id", data.eventId)
      .eq("label", data.label)
      .maybeSingle();

    let setId = existing?.id as string | undefined;
    if (setId) {
      await supabaseAdmin
        .from("event_result_sets")
        .update({
          kind: data.kind,
          sort_order: data.sortOrder,
          column_map: data.columnMap,
          imported_at: new Date().toISOString(),
        })
        .eq("id", setId);
      if (data.mode === "replace") {
        await supabaseAdmin.from("event_results").delete().eq("result_set_id", setId);
      }
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("event_result_sets")
        .insert({
          event_id: data.eventId,
          label: data.label,
          kind: data.kind,
          sort_order: data.sortOrder,
          column_map: data.columnMap,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      setId = created.id as string;
    }

    const { data: entrants } = await supabaseAdmin
      .from("event_entrants")
      .select("id, bib_number, entrants:entrants!inner(full_name)")
      .eq("event_id", data.eventId);

    const prepared = buildResultRows({
      eventId: data.eventId,
      resultSetId: setId!,
      columnMap: data.columnMap,
      rows: data.rows,
      entrants: (entrants ?? []) as any[],
    });

    for (let i = 0; i < prepared.length; i += 500) {
      const { error } = await supabaseAdmin.from("event_results").insert(prepared.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }

    return { ok: true, setId, imported: prepared.length };
  });

export const deleteResultSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ setId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/results.server");
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("event_result_sets").delete().eq("id", data.setId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type RiderDetailPayload = {
  status: "ok" | "signin" | "not_found";
  event_name: string | null;
  event_date: string | null;
  rider: TrackedRider | null;
  /** Result sets that have a row for this rider (multi-day / stage breakdown). */
  sets: (ResultSet & { row: ResultRow | null })[];
};

/** Everything we know about one entrant, including their per-stage results. */
export const getRiderDetail = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ eventId: z.string().uuid(), entrantId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<RiderDetailPayload> => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const { resolveOptionalUserId } = await import("@/lib/app-bot.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const userId = await resolveOptionalUserId(getRequestHeader("authorization") ?? null);
    if (!userId)
      return { status: "signin", event_name: null, event_date: null, rider: null, sets: [] };

    const { data: ev } = await supabaseAdmin
      .from("events")
      .select("name, event_date")
      .eq("id", data.eventId)
      .maybeSingle();

    const { data: row } = await supabaseAdmin
      .from("event_entrants")
      .select(
        "id, category, batch, bib_number, started_at, finished_at, entrants:entrants!inner(full_name)",
      )
      .eq("event_id", data.eventId)
      .eq("id", data.entrantId)
      .maybeSingle();

    if (!row)
      return {
        status: "not_found",
        event_name: (ev?.name as string | null) ?? null,
        event_date: (ev?.event_date as string | null) ?? null,
        rider: null,
        sets: [],
      };

    const rider: TrackedRider = {
      id: String(row.id),
      full_name: String((row as any).entrants?.full_name ?? ""),
      bib_number: (row.bib_number as string | null) ?? null,
      category: (row.category as string | null) ?? null,
      batch: (row.batch as string | null) ?? null,
      started_at: (row.started_at as string | null) ?? null,
      finished_at: (row.finished_at as string | null) ?? null,
    };

    const { data: sets } = await supabaseAdmin
      .from("event_result_sets")
      .select("id, label, kind, sort_order, imported_at")
      .eq("event_id", data.eventId)
      .order("sort_order", { ascending: true });

    const { data: rows } = await supabaseAdmin
      .from("event_results")
      .select(
        "id, result_set_id, event_entrant_id, bib_number, full_name, category, batch, position, time_text, time_ms, gap_text, status, extras",
      )
      .eq("event_id", data.eventId)
      .limit(5000);

    const name = rider.full_name.trim().toLowerCase();
    const mine = (rows ?? []).filter(
      (r: any) =>
        (r.event_entrant_id && String(r.event_entrant_id) === rider.id) ||
        (rider.bib_number && r.bib_number && String(r.bib_number) === rider.bib_number) ||
        (!!name && String(r.full_name ?? "").trim().toLowerCase() === name),
    );

    const toRow = (r: any): ResultRow => ({
      id: String(r.id),
      result_set_id: String(r.result_set_id),
      bib_number: (r.bib_number as string | null) ?? null,
      full_name: String(r.full_name ?? ""),
      category: (r.category as string | null) ?? null,
      batch: (r.batch as string | null) ?? null,
      position: r.position == null ? null : Number(r.position),
      time_text: (r.time_text as string | null) ?? null,
      time_ms: r.time_ms == null ? null : Number(r.time_ms),
      gap_text: (r.gap_text as string | null) ?? null,
      status: (r.status as string | null) ?? null,
      extras: (r.extras as Record<string, string>) ?? {},
    });

    return {
      status: "ok",
      event_name: (ev?.name as string | null) ?? null,
      event_date: (ev?.event_date as string | null) ?? null,
      rider,
      sets: (sets ?? []).map((s: any) => {
        const match = mine.find((r: any) => String(r.result_set_id) === String(s.id));
        return {
          id: String(s.id),
          label: String(s.label),
          kind: String(s.kind ?? "stage"),
          sort_order: Number(s.sort_order ?? 0),
          imported_at: (s.imported_at as string | null) ?? null,
          row: match ? toRow(match) : null,
        };
      }),
    };
  });
