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

export type RunSheetTabDiag = {
  tab: string;
  kind: "tasks" | "packing" | "brief" | "ignored";
  headerRow: number | null;
  rows: number;
  used: number;
  skipped: number;
  unknownColumns: string[];
};

export type RunSheetParse = {
  tasks: RunSheetTaskRow[];
  packing: RunSheetPackingRow[];
  briefs: RunSheetBriefRow[];
  departments: string[];
  skipped: number;
  tabs: RunSheetTabDiag[];
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

/** Lists the tab titles in a spreadsheet. */
async function listTabs(id: string): Promise<string[]> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = connectorKey();
  if (!lovableKey || !connKey) {
    throw new Error("Google Sheets isn't connected yet — link the Google Sheets connection, then try again.");
  }
  const res = await fetch(
    `${GATEWAY_URL}/spreadsheets/${id}?fields=${encodeURIComponent("sheets.properties.title")}`,
    { headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": connKey } },
  );
  if (!res.ok) {
    const body = await res.text();
    console.error(`[run-sheet] tab list ${res.status}: ${body}`);
    throw new Error(`Couldn't open that Google Sheet [${res.status}]: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { sheets?: { properties?: { title?: string } }[] };
  return (json.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
}

const COLS = {
  department: ["department", "dept", "area", "team", "crew", "section", "function"],
  task: ["task", "tasks", "job", "what", "activity", "instruction", "instructions", "action", "item"],
  day: ["day", "date", "when"],
  start: ["start", "start time", "time", "from", "begins"],
  end: ["end", "end time", "to", "until", "finish"],
  detail: ["detail", "details", "description", "how", "brief"],
  owner: ["owner", "responsible", "who", "lead", "assigned", "person"],
  location: ["location", "where", "venue", "place", "site"],
  notes: ["notes", "note", "comments", "comment", "remarks"],
  packItem: ["item", "kit", "equipment", "packing", "gear", "asset"],
  qty: ["qty", "quantity", "amount", "no", "number", "#"],
  critical: ["critical", "essential", "must have", "priority"],
  contact: ["contact", "phone", "cell", "number", "mobile"],
  overview: ["overview", "role", "purpose", "what we do", "description"],
  safety: ["safety", "safety notes", "risks", "rules"],
} as const;

const ALL_KNOWN = new Set<string>(Object.values(COLS).flatMap((v) => v as readonly string[]));
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Finds the row that looks most like a header inside the first rows of a tab. */
function findHeaderRow(values: unknown[][]): number | null {
  let best: { idx: number; score: number } | null = null;
  const limit = Math.min(values.length, 15);
  for (let i = 0; i < limit; i += 1) {
    const cells = (values[i] ?? []).map(norm).filter(Boolean);
    if (cells.length < 2) continue;
    const score = cells.filter((c) => ALL_KNOWN.has(c)).length;
    if (score >= 2 && (!best || score > best.score)) best = { idx: i, score };
  }
  return best ? best.idx : null;
}

const GENERIC_TAB = /^(sheet\d*|run\s*sheet|master|schedule|programme|program|tasks?|main|overview)$/i;

const DAYISH =
  /(mon|tue|wed|thu|fri|sat|sun)|^\d{1,2}[\s/-]|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|day\s*\d/i;

/** Tidies a matrix column heading like "Kyle Driver \n- Vehicles - Green Motion". */
function cleanDeptName(v: string): string {
  const first = v.split("\n")[0]!.trim().replace(/\s+/g, " ");
  return first.slice(0, 60);
}

/**
 * Detects the "grid" run sheet: department names across a top row, days down
 * column A, and each cell holding that department's instructions for the day.
 */
function parseMatrixTab(values: unknown[][]): { headerRow: number; tasks: RunSheetTaskRow[]; departments: string[] } | null {
  const limit = Math.min(values.length, 8);
  let headerRow = -1;
  let width = 0;
  for (let i = 0; i < limit; i += 1) {
    const filled = (values[i] ?? []).filter((c) => String(c ?? "").trim()).length;
    if (filled >= 4 && filled > width) {
      headerRow = i;
      width = filled;
    }
  }
  if (headerRow < 0) return null;

  const header = (values[headerRow] ?? []).map((c) => String(c ?? "").trim());
  const bodyRows = values.slice(headerRow + 1);
  const dayRows = bodyRows.filter((r) => DAYISH.test(String(r?.[0] ?? "").trim()));
  if (dayRows.length < 2) return null;

  // Columns that carry a department heading (skip the day / date columns).
  const deptCols: { idx: number; name: string }[] = [];
  header.forEach((h, idx) => {
    const clean = cleanDeptName(h);
    if (!clean) return;
    if (idx <= 1 && /^(day|date|when)$/i.test(clean)) return;
    if (idx <= 1) return;
    deptCols.push({ idx, name: clean });
  });
  if (deptCols.length < 2) return null;

  const tasks: RunSheetTaskRow[] = [];
  for (const row of bodyRows) {
    const dayCell = String(row?.[0] ?? "").trim();
    if (!DAYISH.test(dayCell)) continue;
    const dateCell = String(row?.[1] ?? "").trim();
    const day = [dayCell, dateCell].filter(Boolean).join(" ");
    for (const col of deptCols) {
      const cell = String(row?.[col.idx] ?? "").trim();
      if (!cell || cell === "," || cell === "-") continue;
      const lines = cell.split("\n").map((l) => l.trim()).filter(Boolean);
      const task = lines[0]!.slice(0, 300);
      const detail = lines.slice(1).join("\n");
      tasks.push({
        department: col.name,
        day,
        start: "",
        end: "",
        task,
        detail,
        owner: "",
        location: "",
        notes: "",
      });
    }
  }
  if (!tasks.length) return null;
  return { headerRow, tasks, departments: deptCols.map((c) => c.name) };
}

/** Pulls every tab of the run sheet and normalises the rows it understands. */
export async function readRunSheet(sheetUrl: string, range?: string | null): Promise<RunSheetParse> {
  const id = spreadsheetIdFromUrl(sheetUrl);
  if (!id) throw new Error("That doesn't look like a Google Sheets link.");

  const explicit = (range ?? "").trim();
  const tabNames = explicit ? [] : await listTabs(id);
  const targets = explicit ? [{ tab: "", range: explicit }] : tabNames.map((t) => ({ tab: t, range: `'${t.replace(/'/g, "''")}'!A1:Z5000` }));

  const tasks: RunSheetTaskRow[] = [];
  const packing: RunSheetPackingRow[] = [];
  const briefs: RunSheetBriefRow[] = [];
  const tabs: RunSheetTabDiag[] = [];
  let skipped = 0;

  const sheets = await Promise.all(
    targets.map(async (t) => ({ tab: t.tab, values: await readRange(id, t.range) })),
  );

  for (const { tab, values } of sheets) {
    const headerRow = findHeaderRow(values);
    if (headerRow === null) {
      const matrix = parseMatrixTab(values);
      if (matrix) {
        tasks.push(...matrix.tasks);
        tabs.push({
          tab: tab || "Sheet",
          kind: "tasks",
          headerRow: matrix.headerRow + 1,
          rows: values.length,
          used: matrix.tasks.length,
          skipped: 0,
          unknownColumns: [],
        });
      } else {
        tabs.push({ tab: tab || "Sheet", kind: "ignored", headerRow: null, rows: values.length, used: 0, skipped: values.length, unknownColumns: [] });
      }
      continue;
    }

    const records = rowsToRecords(values.slice(headerRow));
    const headerCells = (values[headerRow] ?? []).map(norm).filter(Boolean);
    const unknownColumns = headerCells.filter((c) => !ALL_KNOWN.has(c));
    const has = (set: readonly string[]) => headerCells.some((c) => set.includes(c));

    const isPacking = /pack|kit|equipment/i.test(tab);
    const isBrief = /brief|onboard|role|safety/i.test(tab);
    const tabDept = tab && !GENERIC_TAB.test(tab.trim()) && !isPacking && !isBrief ? tab.trim() : "";
    const tabDay = /day\s*\d|reg|build|strike|arriv/i.test(tab) ? tab.trim() : "";

    let used = 0;
    let localSkipped = 0;

    if (isBrief) {
      for (const r of records) {
        const department = pickField(r, [...COLS.department]) || tab.trim();
        if (!department) {
          localSkipped += 1;
          continue;
        }
        briefs.push({
          department,
          lead: pickField(r, ["lead", "manager", "hod", "head", ...COLS.owner]),
          contact: pickField(r, [...COLS.contact]),
          overview: pickField(r, [...COLS.overview]),
          safety: pickField(r, [...COLS.safety]),
        });
        used += 1;
      }
      tabs.push({ tab: tab || "Sheet", kind: "brief", headerRow: headerRow + 1, rows: records.length, used, skipped: localSkipped, unknownColumns });
      continue;
    }

    if (isPacking || (has(COLS.packItem) && !has(COLS.task) && !has(COLS.start))) {
      for (const r of records) {
        const department = pickField(r, [...COLS.department]) || tabDept;
        const item = pickField(r, [...COLS.packItem]);
        if (!department || !item) {
          localSkipped += 1;
          continue;
        }
        packing.push({
          department,
          item,
          qty: pickField(r, [...COLS.qty]),
          notes: pickField(r, [...COLS.notes, ...COLS.detail]),
          critical: yes(pickField(r, [...COLS.critical])),
        });
        used += 1;
      }
      tabs.push({ tab: tab || "Sheet", kind: "packing", headerRow: headerRow + 1, rows: records.length, used, skipped: localSkipped, unknownColumns });
      continue;
    }

    for (const r of records) {
      const department = pickField(r, [...COLS.department]) || tabDept;
      const task = pickField(r, [...COLS.task]);
      if (!department || !task) {
        localSkipped += 1;
        continue;
      }
      tasks.push({
        department,
        day: pickField(r, [...COLS.day]) || tabDay,
        start: pickField(r, [...COLS.start]),
        end: pickField(r, [...COLS.end]),
        task,
        detail: pickField(r, [...COLS.detail]),
        owner: pickField(r, [...COLS.owner]),
        location: pickField(r, [...COLS.location]),
        notes: pickField(r, [...COLS.notes]),
      });
      used += 1;
    }
    skipped += localSkipped;
    tabs.push({ tab: tab || "Sheet", kind: "tasks", headerRow: headerRow + 1, rows: records.length, used, skipped: localSkipped, unknownColumns });
  }

  const departments = Array.from(
    new Set([...tasks, ...packing, ...briefs].map((r) => r.department.trim()).filter(Boolean)),
  );

  return { tasks, packing, briefs, departments, skipped, tabs };
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
    if (!parsed.departments.length) {
      const seen = parsed.tabs.map((t) => `${t.tab} (${t.rows} rows)`).join(", ") || "no tabs";
      throw new Error(
        `Read the sheet but found no Department/Task columns. Tabs checked: ${seen}. Add a "Department" and "Task" column header, or name each tab after its department.`,
      );
    }



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
