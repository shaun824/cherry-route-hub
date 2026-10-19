// Post-event thank-you email: each recipient gets their own (and their
// group's) Day 1, Day 2 and overall results from the live timing feed.
import { resultsForRider } from "./rider-result-matching";
import type { ResultRow, ResultSet } from "./results.functions";

type AnyClient = any;

export interface ThankYouResultLine {
  label: string;
  position: number | null;
  total: number;
  time: string | null;
  genderPlace: string | null;
  overall: boolean;
}
export interface ThankYouPerson {
  name: string;
  bib: string | null;
  lines: ThankYouResultLine[];
}

const cache = new Map<string, { at: number; sets: ResultSet[]; rows: ResultRow[] }>();

/**
 * The live feed sometimes drops whole lists. A thank-you must never show a
 * rider half their weekend, so we refuse to send until every daily list is back.
 */
async function loadResults(admin: AnyClient, eventId: string) {
  const hit = cache.get(eventId);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit;
  const { data: ev } = await admin.from("events").select("myriad_race_id").eq("id", eventId).maybeSingle();
  const raceId = String(ev?.myriad_race_id ?? "").trim();
  if (!raceId) throw new Error("No timing race linked to this event");
  const { fetchRaceResults } = await import("./myriad.server");
  let best: { sets: ResultSet[]; rows: ResultRow[] } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const live = await fetchRaceResults(raceId);
      if (!best || live.sets.length > best.sets.length) best = live;
      const daily = live.sets.filter((s) => /^day\s*\d/i.test(s.label));
      if (daily.length >= 8) break;
    } catch {
      /* retry */
    }
  }
  const daily = best?.sets.filter((s) => /^day\s*\d/i.test(s.label)) ?? [];
  if (!best || daily.length < 8) throw new Error("Results feed incomplete — will retry next run");
  const entry = { at: Date.now(), ...best };
  cache.set(eventId, entry);
  return entry;
}

function cleanLabel(label: string) {
  return label.replace(/\s*overall results\s*$/i, "").replace(/\bGC\b/, "overall (both days)").trim();
}

function linesFor(person: { full_name: string; bib_number: string | null }, sets: ResultSet[], rows: ResultRow[]) {
  const mine = resultsForRider(person, rows);
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.result_set_id, (totals.get(r.result_set_id) ?? 0) + 1);
  const order = (s: ResultSet) => {
    const d = s.label.match(/^day\s*(\d)/i);
    return d ? Number(d[1]) : 9;
  };
  const lines: ThankYouResultLine[] = [];
  for (const set of [...sets].sort((a, b) => order(a) - order(b))) {
    const row = mine.find((r) => r.result_set_id === set.id);
    if (!row) continue;
    lines.push({
      label: cleanLabel(set.label),
      position: row.position,
      total: totals.get(set.id) ?? 0,
      time: row.time_text,
      genderPlace: row.extras?.["Gender Place"] ?? null,
      overall: !/^day\s*\d/i.test(set.label),
    });
  }
  return { bib: mine.find((r) => r.bib_number)?.bib_number ?? person.bib_number, lines };
}

export async function buildThankYouPeople(
  admin: AnyClient,
  eventId: string,
  email: string,
  opts: { sampleIfEmpty?: boolean } = {},
): Promise<ThankYouPerson[]> {
  const { sets, rows } = await loadResults(admin, eventId);
  const { data } = await admin
    .from("event_entrants")
    .select("bib_number, entrants!inner(full_name, email)")
    .eq("event_id", eventId)
    .ilike("entrants.email", email)
    .limit(20);
  const seen = new Set<string>();
  const people: ThankYouPerson[] = [];
  for (const r of (data ?? []) as any[]) {
    const name = String(r.entrants?.full_name ?? "").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const { bib, lines } = linesFor({ full_name: name, bib_number: r.bib_number ?? null }, sets, rows);
    people.push({ name, bib, lines });
  }
  if (!people.some((p) => p.lines.length) && opts.sampleIfEmpty) {
    const sample = rows.find((r) => /day\s*1/i.test(sets.find((s) => s.id === r.result_set_id)?.label ?? "") && (r.position ?? 0) > 20);
    if (sample) {
      const { bib, lines } = linesFor({ full_name: sample.full_name, bib_number: sample.bib_number }, sets, rows);
      return [{ name: `${sample.full_name} (sample rider)`, bib, lines }];
    }
  }
  return people;
}
