// Podium maths: works out each prize category's standings from timing results
// plus the entry roster (class + gender from Entry Ninja). Server-only.
import { courseMismatch } from "./result-course";
import { reviewResults, timedCourse, ridingDay, flagFastPodium, type ResultsIssue } from './results-anomalies';
export type PodiumCategory = {
  key: string;
  title: string;
  tier: "gold" | "silver" | "bronze";
  ebike: boolean;
  age: "u14" | "adult";
  gender: "male" | "female";
};
export type PodiumRider = { pos: number; name: string; bib: string | null; time: string | null; ms: number | null };
export type PodiumStanding = { key: string; title: string; group: string; riders: PodiumRider[] };

const C = (tier: PodiumCategory["tier"], ebike: boolean, age: PodiumCategory["age"], gender: PodiumCategory["gender"]): PodiumCategory => ({
  key: `${tier}${ebike ? "-ebike" : ""}-${age}-${gender}`,
  title: `${age === "u14" ? "Under 14" : "Adult"} – ${gender === "male" ? "Male" : "Female"}`,
  tier,
  ebike,
  age,
  gender,
});

/** Weekend Warrior's official prize-giving categories (weekend-warrior.co.za/prize-giving). */
export const WW_PODIUM: PodiumCategory[] = [
  C("bronze", false, "u14", "male"),
  C("bronze", false, "u14", "female"),
  C("silver", false, "u14", "male"),
  C("silver", false, "adult", "male"),
  C("silver", false, "u14", "female"),
  C("silver", false, "adult", "female"),
  C("gold", false, "adult", "male"),
  C("gold", false, "adult", "female"),
  C("gold", true, "adult", "male"),
  C("gold", true, "adult", "female"),
];

export function groupLabel(c: PodiumCategory) {
  const t = c.tier[0].toUpperCase() + c.tier.slice(1);
  return c.ebike ? `${t} — E-Bike` : `${t} — Analogue bike`;
}

export function podiumConfigFor(ev: { name?: string | null; podium_config?: unknown }): PodiumCategory[] | null {
  if (Array.isArray(ev.podium_config) && ev.podium_config.length) return ev.podium_config as PodiumCategory[];
  if (/weekend warrior/i.test(ev.name ?? "")) return WW_PODIUM;
  return null;
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Which podium category a rider's entry class + gender falls into (weekend pass only). */
export function categoryFor(cats: PodiumCategory[], cls: string | null, gender: string | null): PodiumCategory | null {
  const c = (cls ?? "").toLowerCase();
  if (!c || /day\s*pass/.test(c)) return null;
  const tier = (["gold", "silver", "bronze"] as const).find((t) => c.includes(t));
  if (!tier) return null;
  const ebike = /e-?bike/.test(c);
  const age = /u\/?\s?14|under\s?14/.test(c) ? "u14" : "adult";
  const g = (gender ?? "").toLowerCase().startsWith("f") ? "female" : (gender ?? "").toLowerCase().startsWith("m") ? "male" : null;
  if (!g) return null;
  return cats.find((k) => k.tier === tier && k.ebike === ebike && k.age === age && k.gender === g) ?? null;
}

export function fmtMs(ms: number | null) {
  if (ms == null) return null;
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export type PodiumComputed = {
  cats: PodiumCategory[];
  stagesWithResults: number;
  totalStages: number;
  standings: PodiumStanding[];
  missingGender: { name: string; bib: string | null; category: string | null }[];
  courseMismatches: { name: string; bib: string | null; category: string | null; courses: string[] }[];
  issues: ResultsIssue[];
  lastDay: string | null;
};

export async function computePodium(eventId: string, depth: number): Promise<PodiumComputed | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ev } = await (supabaseAdmin as any)
    .from("events").select("name, podium_config, myriad_race_id, days").eq("id", eventId).maybeSingle();
  if (!ev) return null;
  const cats = podiumConfigFor(ev);
  if (!cats) return null;
  const days: any[] = Array.isArray(ev.days) ? ev.days : [];
  const lastDay = days.map((d) => String(d.date ?? "")).filter(Boolean).sort().pop() ?? null;

  const roster: { name: string; bib: string | null; category: string | null; gender: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await (supabaseAdmin as any)
      .from("event_entrants").select("bib_number, category, gender, entrants:entrants!inner(full_name)")
      .eq("event_id", eventId).range(from, from + 999);
    for (const r of data ?? []) {
      roster.push({ name: String(r.entrants?.full_name ?? "").trim(), bib: r.bib_number ?? null, category: r.category ?? null, gender: r.gender ?? null });
    }
    if (!data || data.length < 1000) break;
  }

  // Results: Myriad live feed first, else imported results.
  let rows: { full_name: string; bib_number: string | null; category?: string | null; time_ms: number | null; result_set_id: string }[] = [];
  let setIds: string[] = [];
  let setLabels = new Map<string, string>();
  let feedError: string | null = null;
  const raceId = String(ev.myriad_race_id ?? "").trim();
  if (raceId) {
    try {
      const { fetchRaceResults } = await import("@/lib/myriad.server");
      const live = await fetchRaceResults(raceId);
      rows = live.rows as any;
      setIds = live.sets.map((s: any) => String(s.id));
      setLabels = new Map(live.sets.map((s: any) => [String(s.id), String(s.label ?? "")]));
    } catch (error) {
      feedError = error instanceof Error ? error.message : 'Timing feed unavailable';
    }
  }
  if (!rows.length) {
    const { data: s } = await (supabaseAdmin as any).from("event_result_sets").select("id, label").eq("event_id", eventId);
    const { data: r } = await (supabaseAdmin as any)
      .from("event_results").select("full_name, bib_number, category, time_ms, result_set_id").eq("event_id", eventId).limit(5000);
    rows = (r ?? []).map((x: any) => ({ ...x, result_set_id: String(x.result_set_id) }));
    setIds = (s ?? []).map((x: any) => String(x.id));
    setLabels = new Map((s ?? []).map((x: any) => [String(x.id), String(x.label ?? "")]));
  }
  // A "stage" is a riding day. Result sets are split per race/start group (Gold,
  // Silver, Bronze each get their own Day 1 set), so group sets by the day in
  // their label; sets with no day label count as their own stage.
  const dayOf = (setId: string) => ridingDay(setLabels.get(setId) ?? '');
  const issues = reviewResults(rows, setLabels, roster);
  if (raceId && (!rows.length || feedError)) issues.push({ kind: 'feed-unavailable', name: 'Timing feed', bib: null, detail: feedError ?? 'No timing rows returned. Podiums cannot be verified from an empty feed.' });
  // Overall/GC sets are cumulative, not an extra day: ignore them when daily sets exist.
  const hasDaySets = setIds.some((id) => dayOf(id) != null);
  const completedDays = days.filter(d => !/registration/i.test(String(d.label ?? '')) && String(d.date ?? '') && String(d.date).slice(0, 10) < new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date())).length;
  if (completedDays > new Set(setIds.map(dayOf).filter(Boolean)).size) issues.push({ kind: 'missing-day', name: 'Timing coverage', bib: null, detail: `Only ${new Set(setIds.map(dayOf).filter(Boolean)).size} riding days have results, but ${completedDays} riding days have ended. Do not finalise weekend podiums until the missing day is confirmed.` });
  const stageOf = (setId: string) => {
    const d = dayOf(setId);
    if (d) return `day${d}`;
    return hasDaySets ? null : `set:${setId}`;
  };

  // Per rider, per stage: best time (a rider in both an overall and a category
  // set for the same day is counted once, not twice).
  const perRider = new Map<string, Map<string, number>>();
  const riderCourses = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.time_ms == null || !Number.isFinite(r.time_ms) || r.time_ms <= 0) continue;
    const st = stageOf(r.result_set_id);
    // Index by race number AND name: entries often have no race number yet.
    const keys = [r.bib_number ? `b:${norm(r.bib_number)}` : null, r.full_name ? `n:${norm(r.full_name)}` : null];
    for (const k of keys) {
      if (!k) continue;
      const course = timedCourse(r, setLabels.get(r.result_set_id) ?? '');
      if (course && st) {
        const courses = riderCourses.get(k) ?? new Set<string>();
        courses.add(course);
        riderCourses.set(k, courses);
      }
      if (!st) continue;
      const stages = perRider.get(k) ?? new Map<string, number>();
      const prev = stages.get(st);
      if (prev == null || r.time_ms < prev) stages.set(st, r.time_ms);
      perRider.set(k, stages);
    }
  }
  const totals = new Map<string, { ms: number; n: number }>();
  let stagesWithResults = 0;
  for (const [k, stages] of perRider) {
    let ms = 0;
    for (const v of stages.values()) ms += v;
    totals.set(k, { ms, n: stages.size });
    stagesWithResults = Math.max(stagesWithResults, stages.size);
  }

  const pending = new Map<string, (PodiumRider & { n: number })[]>();
  const missingGender: PodiumComputed["missingGender"] = [];
  const courseMismatches: PodiumComputed["courseMismatches"] = [];
  for (const p of roster) {
    if (!p.name || /test|placeholder/i.test(p.name)) continue;
    const cat = categoryFor(cats, p.category, p.gender);
    if (!cat) {
      if (!p.gender && categoryFor(cats, p.category, "male")) missingGender.push({ name: p.name, bib: p.bib, category: p.category });
      continue;
    }
    const hasBib = p.bib && totals.has(`b:${norm(p.bib)}`);
    const nameBibs = new Set(rows.filter(r => norm(r.full_name) === norm(p.name)).map(r => r.bib_number).filter(Boolean));
    if (!hasBib && nameBibs.size > 1) continue;
    const identity = hasBib ? `b:${norm(p.bib)}` : `n:${norm(p.name)}`;
    const t = totals.get(identity);
    if (!t) continue;
    const courses = [...(riderCourses.get(identity) ?? [])];
    if (courseMismatch(p.category, courses)) {
      courseMismatches.push({ name: p.name, bib: p.bib, category: p.category, courses });
      continue;
    }
    pending.set(cat.key, [...(pending.get(cat.key) ?? []), { pos: 0, name: p.name, bib: p.bib, ms: t.ms, time: fmtMs(t.ms), n: t.n }]);
  }
  // Ranked only when they have a time on every stage that this category has results for so far.
  const byCat = new Map<string, PodiumRider[]>();
  for (const [key, list] of pending) {
    const need = Math.max(...list.map((r) => r.n));
    byCat.set(key, list.filter((r) => r.n >= need).map(({ n: _n, ...r }) => r));
  }
  const standings = cats.map((c) => ({
    key: c.key,
    title: c.title,
    group: groupLabel(c),
    riders: (byCat.get(c.key) ?? [])
      .sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0))
      .map((r, i) => ({ ...r, pos: i + 1 })),
  }));
  issues.push(...flagFastPodium(standings));
  return { cats, stagesWithResults, totalStages: Math.max(hasDaySets ? new Set(setIds.map(dayOf).filter(Boolean)).size : setIds.length, days.filter((d) => /day\s*\d/i.test(String(d.label ?? ""))).length), standings: standings.map(s => ({ ...s, riders: s.riders.slice(0, depth) })), missingGender, courseMismatches, issues, lastDay };
}
