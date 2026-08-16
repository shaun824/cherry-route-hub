import { checkIsAdmin } from "@/lib/is-admin";

export async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const ok = await checkIsAdmin(context.supabase as never);
  if (!ok) throw new Error("Forbidden");
}

/** Parse "1:23:45", "23:45.6", "1h 23m" style times into milliseconds. */
export function parseTimeMs(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (m) {
    const h = m[1] ? Number(m[1]) : 0;
    const min = Number(m[2]);
    const sec = Number(m[3]);
    return Math.round(((h * 60 + min) * 60 + sec) * 1000);
  }
  const alt = s.match(/^(\d+(?:\.\d+)?)\s*$/);
  if (alt) return Math.round(Number(alt[1]) * 1000);
  return null;
}

function norm(v: string | undefined | null) {
  return (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

type EntrantRow = { id: string; bib_number: string | null; entrants?: { full_name?: string } };

export function buildResultRows(args: {
  eventId: string;
  resultSetId: string;
  columnMap: Record<string, string>;
  rows: Record<string, string>[];
  entrants: EntrantRow[];
}) {
  const byBib = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const e of args.entrants) {
    if (e.bib_number) byBib.set(norm(e.bib_number), e.id);
    const n = norm(e.entrants?.full_name);
    if (n) byName.set(n, e.id);
  }

  const mapped = args.columnMap;
  const known = new Set(Object.values(mapped).filter(Boolean));

  const out = args.rows.map((row, idx) => {
    const get = (field: string) => {
      const col = mapped[field];
      return col ? (row[col] ?? "").trim() : "";
    };
    const bib = get("bib_number") || null;
    const fullName = get("full_name");
    const positionRaw = get("position").replace(/[^\d]/g, "");
    const timeText = get("time_text") || null;
    const extras: Record<string, string> = {};
    for (const [col, val] of Object.entries(row)) {
      if (!known.has(col) && val?.trim()) extras[col] = val.trim();
    }
    const entrantId =
      (bib ? byBib.get(norm(bib)) : undefined) ?? (fullName ? byName.get(norm(fullName)) : undefined) ?? null;

    return {
      event_id: args.eventId,
      result_set_id: args.resultSetId,
      event_entrant_id: entrantId,
      bib_number: bib,
      full_name: fullName || bib || `Row ${idx + 1}`,
      category: get("category") || null,
      batch: get("batch") || null,
      position: positionRaw ? Number(positionRaw) : null,
      time_text: timeText,
      time_ms: parseTimeMs(timeText),
      gap_text: get("gap_text") || null,
      status: get("status") || null,
      extras,
    };
  });

  return out;
}
