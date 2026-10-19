import { courseMismatch, resultCourse } from './result-course'

export type ReviewRow = { full_name: string; bib_number: string | null; time_ms: number | null; result_set_id: string; category?: string | null; position?: number | null }
export type ResultsIssue = { kind: string; name: string; bib: string | null; detail: string }
export const identityText = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
export const ridingDay = (label: string) => /day\s*(\d+)/i.exec(label)?.[1] ?? null

/** Daily set identifies the course ridden; Registration Event identifies the entry, not the ride. */
export function timedCourse(row: ReviewRow, label: string): string | null {
  const course = resultCourse(label)
  if (!course) return resultCourse(row.category)
  // Silver/Bronze daily lists mix bike types; lack of “eBike” is not proof of analogue.
  return course.endsWith('-ebike') || !/e[\s-]?bike/i.test(row.category ?? '') ? course : `${course}-ebike`
}

export function reviewResults(rows: ReviewRow[], labels: Map<string, string>, roster: { name: string; bib: string | null; category: string | null }[]): ResultsIssue[] {
  const issues: ResultsIssue[] = []
  const seen = new Set<string>()
  const add = (issue: ResultsIssue) => {
    const key = JSON.stringify(issue)
    if (!seen.has(key)) { seen.add(key); issues.push(issue) }
  }
  const daily = rows.filter(r => ridingDay(labels.get(r.result_set_id) ?? '') !== null)
  const groups = new Map<string, ReviewRow[]>()
  for (const r of daily) {
    const day = ridingDay(labels.get(r.result_set_id) ?? '')
    const key = `${r.result_set_id}:${r.bib_number ? `b:${identityText(r.bib_number)}` : `n:${identityText(r.full_name)}`}`
    groups.set(key, [...(groups.get(key) ?? []), r])
    if (r.time_ms !== null && (!Number.isFinite(r.time_ms) || r.time_ms <= 0)) {
      add({ kind: 'invalid-time', name: r.full_name, bib: r.bib_number, detail: `Day ${day}: invalid/non-positive finish time; confirm with timing team.` })
    }
  }
  for (const group of groups.values()) {
    const names = new Set(group.map(r => identityText(r.full_name)))
    const times = new Set(group.map(r => r.time_ms))
    if (names.size > 1 || times.size > 1) {
      const r = group[0]
      if (r) add({ kind: 'duplicate-result', name: group.map(x => x.full_name).join(' / '), bib: r.bib_number, detail: `${labels.get(r.result_set_id)}: conflicting rows for the same identity; fastest row must be reviewed.` })
    }
  }
  for (const p of roster) {
    const byBib = p.bib ? daily.filter(r => identityText(r.bib_number) === identityText(p.bib)) : []
    const byName = daily.filter(r => identityText(r.full_name) === identityText(p.name))
    const namedBibs = new Set(byName.map(r => r.bib_number).filter(Boolean))
    if (!byBib.length && namedBibs.size > 1) {
      add({ kind: 'ambiguous-identity', name: p.name, bib: p.bib, detail: 'This name has multiple timing bibs; name-only matching is unsafe.' })
      continue
    }
    const matched = byBib.length ? byBib : byName
    const courses = [...new Set(matched.filter(r => r.time_ms !== null).map(r => timedCourse(r, labels.get(r.result_set_id) ?? '')).filter((x): x is string => x !== null))]
    if (courseMismatch(p.category, courses)) add({ kind: 'course-mismatch', name: p.name, bib: p.bib ?? matched[0]?.bib_number ?? null, detail: `Entry: ${p.category}; timed riding-day courses: ${courses.join(', ')}. Excluded from automatic weekend podium; timing team must confirm any correction.` })
  }
  const dailyByBib = new Map<string, Map<string, number>>()
  for (const r of daily) {
    if (!r.bib_number || !r.time_ms || r.time_ms <= 0) continue
    const day = ridingDay(labels.get(r.result_set_id) ?? '')
    if (!day) continue
    const times = dailyByBib.get(r.bib_number) ?? new Map<string, number>()
    times.set(day, Math.min(times.get(day) ?? Infinity, r.time_ms))
    dailyByBib.set(r.bib_number, times)
  }
  const observedDays = new Set(daily.map(r => ridingDay(labels.get(r.result_set_id) ?? ''))).size
  for (const r of rows) {
    if (!/\bGC\b|general classification/i.test(labels.get(r.result_set_id) ?? '') || !r.time_ms || !r.bib_number) continue
    const times = dailyByBib.get(r.bib_number)
    if (times && times.size === observedDays && observedDays > 1) {
      const sum = [...times.values()].reduce((a, b) => a + b, 0)
      if (Math.abs(sum - r.time_ms) > 1000) add({ kind: 'gc-total', name: r.full_name, bib: r.bib_number, detail: `Overall total differs from the daily sum by ${Math.round(Math.abs(sum - r.time_ms) / 1000)} seconds; confirm penalties, adjustments or missing timing with the timing team.` })
    }
  }
  for (const r of rows) {
    if (!/\bGC\b/i.test(labels.get(r.result_set_id) ?? '') || !r.position || r.position > 3 || !r.time_ms) continue
    const known = roster.some(p => p.bib ? identityText(p.bib) === identityText(r.bib_number) : identityText(p.name) === identityText(r.full_name))
    if (!known) add({ kind: 'unmatched-contender', name: r.full_name, bib: r.bib_number, detail: `${labels.get(r.result_set_id)}: top-three timing rider cannot be matched to an entry by bib or full name. They may be omitted from automatic podiums; confirm their identity and category.` })
  }
  return issues
}

/** A very large gap is a review signal, never proof of cheating or a different course. */
export function flagFastPodium(standings: { group: string; title: string; riders: { name: string; bib: string | null; ms: number | null }[] }[]): ResultsIssue[] {
  const issues: ResultsIssue[] = []
  for (const s of standings) {
    const riders = s.riders.filter(r => r.ms !== null && r.ms > 0)
    if (riders.length < 5) continue
    const values = riders.map(r => r.ms ?? 0).sort((a, b) => a - b)
    const median = values[Math.floor(values.length / 2)] ?? 0
    for (let i = 0; i < Math.min(3, riders.length); i++) {
      const r = riders[i], next = riders[i + 1]
      if (r?.ms && next?.ms && r.ms < median * 0.5 && r.ms < next.ms * 0.65) {
        issues.push({ kind: 'unusually-fast', name: r.name, bib: r.bib, detail: `${s.group} / ${s.title}: total is under half the class median and at least 35% faster than the next rider. Flag only — verify the course and timing before changing the podium.` })
      }
    }
  }
  return issues
}

export function isEventRidingDate(days: unknown, now: Date): boolean {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  return Array.isArray(days) && days.some(d => d && typeof d === 'object' && String(d.date ?? '').slice(0, 10) === date && !/registration/i.test(String(d.label ?? '')))
}