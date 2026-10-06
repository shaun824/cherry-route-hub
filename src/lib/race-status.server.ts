// Who has finished and who is still out, from the timing (results) system.
// Works off results + the entry roster, never off live GPS.
export type RaceStatusRider = {
  name: string;
  bib: string | null;
  category: string | null;
  timeText: string | null;
  finishedAt: string | null;
};
export type RaceStatusPayload = {
  source: "myriad" | "import" | "none";
  days: { key: string; label: string }[];
  dayKey: string | null;
  finished: RaceStatusRider[];
  stillOut: RaceStatusRider[];
  error: string | null;
};

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

function parseStart(s: string | null | undefined): number | null {
  if (!s) return null;
  let v = s.trim().replace(" ", "T");
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(v)) v += "+02:00"; // Myriad times are SA local
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}
const dayKeyOf = (t: number) => new Date(t + 2 * 3600_000).toISOString().slice(0, 10);

export async function buildRaceStatus(eventId: string, wantDay: string | null): Promise<RaceStatusPayload> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ev } = await supabaseAdmin.from("events").select("myriad_race_id").eq("id", eventId).maybeSingle();
  const raceId = ((ev?.myriad_race_id as string | null) ?? "").trim();

  const { data: ents } = await supabaseAdmin
    .from("event_entrants")
    .select("bib_number, category, entrants:entrants!inner(full_name)")
    .eq("event_id", eventId)
    .limit(3000);
  const roster = (ents ?? [])
    .map((r: any) => ({
      name: String(r.entrants?.full_name ?? "").trim(),
      bib: (r.bib_number as string | null) ?? null,
      category: (r.category as string | null) ?? null,
    }))
    .filter((r) => r.name && !/test|placeholder/i.test(r.name));

  type Row = { full_name: string; bib_number: string | null; category: string | null; time_text: string | null; time_ms: number | null; result_set_id: string };
  let rows: Row[] = [];
  let sets: { id: string; label: string; start_time?: string | null }[] = [];
  let source: RaceStatusPayload["source"] = "none";
  let error: string | null = null;

  if (raceId) {
    try {
      const { fetchRaceResults } = await import("@/lib/myriad.server");
      const live = await fetchRaceResults(raceId);
      rows = live.rows;
      sets = live.sets;
      source = "myriad";
    } catch (e) {
      error = e instanceof Error ? e.message : "Results feed unavailable";
    }
  }
  if (source === "none") {
    const { data: s } = await supabaseAdmin.from("event_result_sets").select("id, label, imported_at").eq("event_id", eventId);
    const { data: r } = await supabaseAdmin
      .from("event_results")
      .select("full_name, bib_number, category, time_text, time_ms, result_set_id")
      .eq("event_id", eventId)
      .limit(5000);
    if ((r ?? []).length) {
      source = "import";
      sets = (s ?? []).map((x: any) => ({ id: String(x.id), label: String(x.label), start_time: null }));
      rows = (r ?? []).map((x: any) => ({ ...x, result_set_id: String(x.result_set_id) }));
    }
  }

  // Group result sets into days (by gun start), else one bucket per set.
  const setDay = new Map<string, { key: string; label: string; start: number | null }>();
  for (const s of sets) {
    const st = parseStart(s.start_time);
    if (st != null) {
      const key = dayKeyOf(st);
      setDay.set(s.id, {
        key,
        label: new Date(st).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Johannesburg" }),
        start: st,
      });
    } else setDay.set(s.id, { key: `set:${s.id}`, label: s.label, start: null });
  }
  const dayMap = new Map<string, string>();
  for (const d of setDay.values()) dayMap.set(d.key, d.label);
  const days = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, label]) => ({ key, label }));
  const today = dayKeyOf(Date.now());
  const dayKey =
    (wantDay && dayMap.has(wantDay) ? wantDay : null) ??
    (dayMap.has(today) ? today : null) ??
    [...days].reverse().find((d) => d.key <= today)?.key ??
    days[days.length - 1]?.key ??
    null;

  const byKey = new Map<string, RaceStatusRider>();
  for (const r of rows) {
    const d = setDay.get(r.result_set_id);
    if (!d || d.key !== dayKey) continue;
    if (!r.time_text) continue;
    const k = r.bib_number ? `b:${norm(r.bib_number)}` : `n:${norm(r.full_name)}`;
    if (byKey.has(k)) continue;
    byKey.set(k, {
      name: r.full_name,
      bib: r.bib_number,
      category: r.category,
      timeText: r.time_text,
      finishedAt: d.start != null && r.time_ms != null ? new Date(d.start + r.time_ms).toISOString() : null,
    });
  }
  const finished = [...byKey.values()].sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
  const doneBibs = new Set(finished.map((f) => norm(f.bib)).filter(Boolean));
  const doneNames = new Set(finished.map((f) => norm(f.name)));
  const stillOut =
    dayKey == null
      ? []
      : roster
          .filter((r) => !(r.bib && doneBibs.has(norm(r.bib))) && !doneNames.has(norm(r.name)))
          .map((r) => ({ ...r, timeText: null, finishedAt: null }))
          .sort((a, b) => a.name.localeCompare(b.name));

  return { source, days, dayKey, finished, stillOut, error };
}
