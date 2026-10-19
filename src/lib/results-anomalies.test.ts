import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { reviewResults, timedCourse, flagFastPodium, isEventRidingDate } from './results-anomalies'

const row = { full_name: 'Hannes Kriel', bib_number: '271', time_ms: 3123770, result_set_id: 'd1', category: 'Silver - Adult Weekend Warrior' }
describe('podium issue review', () => {
  it('uses the Bronze course ridden, not the Silver registration field for #271', () => {
    assert.equal(timedCourse(row, 'Day 1 Bronze Overall Results'), 'bronze')
    assert.equal(reviewResults([row], new Map([['d1', 'Day 1 Bronze Overall Results']]), [{ name: row.full_name, bib: '271', category: row.category }])[0]?.kind, 'course-mismatch')
  })
  it('does not use an overall classification as proof of a course switch', () => {
    assert.deepEqual(reviewResults([{ ...row, result_set_id: 'gc' }], new Map([['gc', 'Bronze GC']]), [{ name: row.full_name, bib: '271', category: row.category }]), [])
  })
  it('does not call a Silver e-bike rider analogue just because Silver has a mixed daily list', () => {
    assert.equal(timedCourse({ ...row, category: 'E-Bike Silver - Adult Weekend Warrior' }, 'Day 1 Silver Overall Results'), 'silver-ebike')
  })
  it('flags a GC total that does not add up to the two daily times', () => {
    const rows = [{ ...row, time_ms: 3600000 }, { ...row, result_set_id: 'd2', time_ms: 3600000 }, { ...row, result_set_id: 'gc', time_ms: 3600000 }]
    assert.equal(reviewResults(rows, new Map([['d1', 'Day 1 Silver'], ['d2', 'Day 2 Silver'], ['gc', 'Silver GC']]), [])[0]?.kind, 'gc-total')
  })
  it('flags a top-three overall rider missing from the roster instead of silently omitting them', () => {
    assert.equal(reviewResults([{ ...row, result_set_id: 'gc', position: 1 }], new Map([['gc', 'Gold GC']]), [])[0]?.kind, 'unmatched-contender')
  })
  it('flags conflicting times within the same daily set', () => {
    assert.equal(reviewResults([row, { ...row, time_ms: 100000 }], new Map([['d1', 'Day 1 Silver']]), [])[0]?.kind, 'duplicate-result')
  })
  it('does not flag identical copies in daily and category result sets', () => {
    assert.deepEqual(reviewResults([row, { ...row, result_set_id: 'other' }], new Map([['d1', 'Day 1 Silver'], ['other', 'Day 1 Silver category']]), []), [])
  })
  it('flags zero time rather than silently trusting it', () => {
    assert.equal(reviewResults([{ ...row, time_ms: 0 }], new Map([['d1', 'Day 1 Silver']]), [])[0]?.kind, 'invalid-time')
  })
  it('flags a one-hour leader among three-hour riders without removing anybody', () => {
    const riders = [3600000, 10800000, 11000000, 11200000, 11400000].map((ms, i) => ({ name: `Rider ${i}`, bib: `${i}`, ms }))
    assert.equal(flagFastPodium([{ group: 'Silver', title: 'Male', riders }])[0]?.name, 'Rider 0')
    assert.equal(riders.length, 5)
  })
  it('does not accuse an ordinary fast winner', () => {
    assert.deepEqual(flagFastPodium([{ group: 'Gold', title: 'Male', riders: [7200000, 7500000, 8100000, 8300000, 9000000].map(ms => ({ name: 'Rider', bib: null, ms })) }]), [])
  })
  it('runs on the Johannesburg riding date, not registration or the following day', () => {
    const days = [{ date: '2026-10-16', label: 'Registration Day' }, { date: '2026-10-17', label: 'Day 1' }]
    assert.equal(isEventRidingDate(days, new Date('2026-10-16T22:10:00Z')), true)
    assert.equal(isEventRidingDate(days, new Date('2026-10-16T12:00:00Z')), false)
    assert.equal(isEventRidingDate(days, new Date('2026-10-18T12:00:00Z')), false)
  })
})