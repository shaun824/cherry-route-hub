// Server-only: reads an event's master run sheet out of Google Sheets and
// rewrites the app's departments, daily tasks and packing lists from it.
// Crew tick-off state and approved packing suggestions are preserved.
import { pickField, rowsToRecords } from "@/lib/rooming-import";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_sheets/v4";

type AnyClient = { from: (table: string) => any };

export type RunSheetTaskRow = {
  department: string;
  day: string;
  start: string;
  end: string;
  task: string;
  detail: string;
  owner: string;
  location: string;
  notes: string;
};

export type RunSheetPackingRow = {
  department: string;
  item: string;
  qty: string;
  notes: string;
  critical: boolean;
};

export type RunSheetBriefRow = {
  department: string;
  lead: string;
  contact: string;
  overview: string;
  safety: string;
};

export type RunSheetParse = {
  tasks: RunSheetTaskRow[];
  packing: RunSheetPackingRow[];
  briefs: RunSheetBriefRow[];
  departments: string[];
  skipped: number;
};

export function spreadsheetIdFromUrl(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

function connectorKey(): string | undefined {
  const env = process.env as Record<string, string | undefined>;
  if (env["GOOGLE_SHEETS_API_KEY"]) return env["GOOGLE_SHEETS_API_KEY"];
  const key = Object.keys(env).find((k) => k.startsWith("GOOGLE_SHEETS") && k.endsWith("API_KEY"));
  return key ? env[key] : undefined;
}

/** Reads one A1 range. Missing tabs come back as an empty list rather than an error. */
async function readRange(id: string, range: string): Promise<unknown[][]> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = connectorKey();
  if (!lovableKey || !connKey) {
    throw new Error("Google Sheets isn't connected yet — link the Google Sheets connection, then try again.");
  }
  const res = await fetch(`${GATEWAY_URL}/spreadsheets/${id}/values/${encodeURIComponent(range)}`, {
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": connKey },
  });
  if (res.status === 400 || res.status === 404) return [];
  if (!res.ok) {
    const body = await res.text();
    console.error(`[run-sheet] gateway ${res.status}: ${body}`);
    throw new Error(`Google Sheets request failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { values?: unknown[][] };
  return json.values ?? [];
}

const yes = (v: string) => /^(y|yes|true|1|critical)$/i.test(v.trim());

/** Pulls the run sheet, packing and brief tabs and normalises every row. */
export async function readRunSheet(sheetUrl: string, range?: string | null): Promise<RunSheetParse> {
  const id = spreadsheetIdFromUrl(sheetUrl);
  if (!id) throw new Error("That doesn't look like a Google Sheets link.");

  const mainRange = (range ?? "").trim() || "A1:Z5000";
  const [mainVals, packVals, briefVals] = await Promise.all([
    readRange(id, mainRange),
    readRange(id, "Packing!A1:Z2000"),
    readRange(id, "Brief!A1:Z500"),
  ]);

  let skipped = 0;
  const tasks: RunSheetTaskRow[] = [];
  for (const r of rowsToRecords(mainVals)) {
    const department = pickField(r, ["department", "Department", "Dept", "Area", "Team"]);
    const task = pickField(r, ["task", "Task", "Instruction", "Activity", "Item", "What"]);
    if (!department || !task) {
      skipped += 1;
      continue;
    }
    tasks.push({
      department,
      day: pickField(r, ["day", "Day", "Date"]),
      start: pickField(r, ["start", "Start", "Start Time", "Time", "From"]),
      end: pickField(r, ["end", "End", "End Time", "To", "Until"]),
      task,
      detail: pickField(r, ["detail", "Detail", "Details", "Description", "How"]),
      owner: pickField(r, ["owner", "Owner", "Responsible", "Who", "Lead"]),
      location: pickField(r, ["location", "Location", "Where", "Venue", "Area"]),
      notes: pickField(r, ["notes", "Notes", "Comments", "Remarks"]),
    });
  }

  const packing: RunSheetPackingRow[] = [];
  for (const r of rowsToRecords(packVals)) {
    const department = pickField(r, ["department", "Department", "Dept", "Team"]);
    const item = pickField(r, ["item", "Item", "Kit", "Equipment", "Packing"]);
    if (!department || !item) continue;
    packing.push({
      department,
      item,
      qty: pickField(r, ["qty", "Qty", "Quantity", "Amount", "No"]),
      notes: pickField(r, ["notes", "Notes", "Comment", "Detail"]),
      critical: yes(pickField(r, ["critical", "Critical", "Essential", "Must Have"])),
    });
  }

  const briefs: RunSheetBriefRow[] = [];
  for (const r of rowsToRecords(briefVals)) {
    const department = pickField(r, ["department", "Department", "Dept", "Team"]);
    if (!department) continue;
    briefs.push({
      department,
      lead: pickField(r, ["lead", "Lead", "Manager", "HOD", "Head"]),
      contact: pickField(r, ["contact", "Contact", "Phone", "Cell", "Number"]),
      overview: pickField(r, ["overview", "Overview", "Role", "Purpose", "What we do", "Description"]),
      safety: pickField(r, ["safety", "Safety", "Safety notes", "Risks", "Rules"]),
    });
  }

  const departments = Array.from(
    new Set([...tasks, ...packing, ...briefs].map((r) => r.department.trim()).filter(Boolean)),
  );

  return { tasks, packing, briefs, departments, skipped };
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "dept";
}

/** Groups day labels into a stable order (blank days sort first). */
function dayOrder(labels: string[]): Map<string, number> {
  const seen: string[] = [];
  for (const l of labels) if (!seen.includes(l)) seen.push(l);
  const numbered = seen
    .map((l) => ({ l, n: Number((l.match(/(\d+)/) ?? [])[1] ?? NaN) }))
    .sort((a, b) => {
      if (Number.isNaN(a.n) && Number.isNaN(b.n)) return seen.indexOf(a.l) - seen.indexOf(b.l);
      if (Number.isNaN(a.n)) return -1;
      if (Number.isNaN(b.n)) return 1;
      return a.n - b.n;
    });
  return new Map(numbered.map((x, i) => [x.l, i]));
}

export type SyncResult = {
  ok: boolean;
  event: string;
  departments: number;
  tasks: number;
  packing: number;
  skipped: number;
  error?: string;
};

/** Pulls the linked sheet and rewrites this event's run sheet content. */
export async function syncEventRunSheet(client: AnyClient, eventId: string): Promise<SyncResult> {
  const { data: event } = await client
    .from("events")
    .select("id, name, run_sheet_url")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) throw new Error("Event not found.");
  if (!event.run_sheet_url) throw new Error("This event has no run sheet linked.");

  try {
    const parsed = await readRunSheet(event.run_sheet_url);

    // Departments: upsert by slug so assignments and waivers survive a resync.
    const { data: existingDepts } = await client
      .from("event_departments")
      .select("id, slug")
      .eq("event_id", eventId);
    const bySlug = new Map<string, string>(
      ((existingDepts ?? []) as { id: string; slug: string }[]).map((d) => [d.slug, d.id]),
    );
    const briefBySlug = new Map(parsed.briefs.map((b) => [slugify(b.department), b]));

    let order = 0;
    for (const name of parsed.departments) {
      const slug = slugify(name);
      const brief = briefBySlug.get(slug);
      const row = {
        event_id: eventId,
        name,
        slug,
        lead_name: brief?.lead || null,
        contact: brief?.contact || null,
        overview: brief?.overview || null,
        safety_notes: brief?.safety || null,
        sort_order: order++,
      };
      const existing = bySlug.get(slug);
      if (existing) {
        await client.from("event_departments").update(row).eq("id", existing);
      } else {
        const { data: ins } = await client.from("event_departments").insert(row).select("id").single();
        if (ins?.id) bySlug.set(slug, ins.id as string);
      }
    }

    // Tasks: full rewrite (the sheet is the source of truth).
    await client.from("run_sheet_tasks").delete().eq("event_id", eventId);
    const dayIdx = dayOrder(parsed.tasks.map((t) => t.day.trim()));
    const taskRows = parsed.tasks
      .map((t, i) => {
        const deptId = bySlug.get(slugify(t.department));
        if (!deptId) return null;
        return {
          event_id: eventId,
          department_id: deptId,
          day_label: t.day.trim(),
          day_index: dayIdx.get(t.day.trim()) ?? 0,
          start_time: t.start || null,
          end_time: t.end || null,
          task: t.task,
          detail: t.detail || null,
          owner: t.owner || null,
          location: t.location || null,
          notes: t.notes || null,
          sort_order: i,
        };
      })
      .filter(Boolean);
    for (let i = 0; i < taskRows.length; i += 500) {
      await client.from("run_sheet_tasks").insert(taskRows.slice(i, i + 500));
    }

    // Packing: replace the sheet-sourced rows, keep approved crew additions.
    await client
      .from("department_packing_items")
      .delete()
      .eq("event_id", eventId)
      .eq("source", "sheet");
    const packRows = parsed.packing
      .map((p, i) => {
        const deptId = bySlug.get(slugify(p.department));
        if (!deptId) return null;
        return {
          event_id: eventId,
          department_id: deptId,
          item: p.item,
          qty: p.qty || null,
          notes: p.notes || null,
          critical: p.critical,
          source: "sheet",
          sort_order: i,
        };
      })
      .filter(Boolean);
    for (let i = 0; i < packRows.length; i += 500) {
      await client.from("department_packing_items").insert(packRows.slice(i, i + 500));
    }

    await client
      .from("events")
      .update({
        run_sheet_synced_at: new Date().toISOString(),
        run_sheet_error: null,
        run_sheet_rows: taskRows.length,
      })
      .eq("id", eventId);

    return {
      ok: true,
      event: event.name as string,
      departments: parsed.departments.length,
      tasks: taskRows.length,
      packing: packRows.length,
      skipped: parsed.skipped,
    };
  } catch (err) {
    const message = (err as Error).message;
    await client.from("events").update({ run_sheet_error: message }).eq("id", eventId);
    return {
      ok: false,
      event: event.name as string,
      departments: 0,
      tasks: 0,
      packing: 0,
      skipped: 0,
      error: message,
    };
  }
}
