import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ICE_EVENT_ID, ICE_MOTORBIKES_LIST_ID, ICE_RACE_WEEK_SEND_AT, iceInterestPayload, iceInterestSchema } from './ice-interest';

describe('ICE website opt-in rules', () => {
  it('requires first name and email and normalises them', () => {
    assert.equal(iceInterestSchema.safeParse({ firstName: '', email: 'sam@example.com', consent: true }).success, false);
    assert.equal(iceInterestSchema.safeParse({ firstName: 'Sam', email: 'invalid', consent: true }).success, false);
    const data = iceInterestSchema.parse({ firstName: ' Sam ', email: ' SAM@Example.com ', consent: true });
    assert.equal(data.firstName, 'Sam');
    assert.equal(data.email, 'sam@example.com');
  });
  it('requires explicit consent', () => {
    assert.equal(iceInterestSchema.safeParse({ firstName: 'Sam', email: 'sam@example.com', consent: false }).success, false);
  });
  it('only accepts signups for the ICE event and Motorbikes master list', () => {
    assert.equal(iceInterestPayload(iceInterestSchema.parse({ firstName: 'Sam', email: 'sam@example.com', consent: true })).event_id, ICE_EVENT_ID);
    assert.equal(ICE_MOTORBIKES_LIST_ID, '97023');
  });
  it('keeps race week scheduled for 24 November at 09:00 SAST', () => {
    assert.equal(new Date(ICE_RACE_WEEK_SEND_AT).getTime(), new Date('2026-11-24T09:00:00+02:00').getTime());
  });
});