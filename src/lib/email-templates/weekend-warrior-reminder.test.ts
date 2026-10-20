import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ENTRY_URL, LOURENSFORD_ENTRY_URL, REMINDER_URL } from './weekend-warrior-brand'

describe('Otto1890 Weekend Warrior entries reminder', () => {
  it('opens on 1 December 2026 at 09:00 Johannesburg time', () => {
    const reminder = new URL(REMINDER_URL)
    assert.equal(reminder.searchParams.get('dates'), '20261201T070000Z/20261201T071500Z')
    assert.equal(reminder.searchParams.get('ctz'), 'Africa/Johannesburg')
  })
  it('uses the Grabouw / Oak Valley entry destination', () => {
    assert.equal(ENTRY_URL, 'https://entries.redcherryevents.co.za/events/84713')
    assert.ok(new URL(REMINDER_URL).searchParams.get('details')?.includes(ENTRY_URL))
  })
  it('uses the distinct Lourensford 2027 entry destination', () => {
    assert.equal(LOURENSFORD_ENTRY_URL, 'https://entries.redcherryevents.co.za/events/84714')
    assert.ok(new URL(REMINDER_URL).searchParams.get('details')?.includes(LOURENSFORD_ENTRY_URL))
  })
})