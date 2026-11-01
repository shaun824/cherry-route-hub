import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { interestConfirmationKey, mergeAudiences, normaliseEmail, renewedInterestConsent } from './event-interest';

it('explicit repeat consent clears the event unsubscribe and renews consent time', () => {
  const now = '2026-11-01T07:22:00.000Z';
  assert.deepEqual(renewedInterestConsent(now), { consent: true, consent_at: now, updated_at: now, unsubscribed_at: null });
});

it('rejoining gets one new confirmation, ordinary duplicates keep the original key', () => {
  assert.equal(interestConfirmationKey('signup-1', null), 'event-interest-confirm-signup-1');
  assert.equal(interestConfirmationKey('signup-1', '2026-10-31T10:00:00Z'), 'event-interest-confirm-signup-1-rejoin-2026-10-31T10:00:00Z');
  assert.notEqual(interestConfirmationKey('signup-1', '2026-10-31T10:00:00Z'), interestConfirmationKey('signup-1', '2026-11-01T07:00:00Z'));
});

const entrants = [
  { email: 'Rider@Example.com', name: 'Rider One' },
  { email: 'two@example.com', name: 'Rider Two' },
];
const interest = [
  { email: 'rider@example.com', name: 'Rider Interest', interestId: 'i1' },
  { email: 'three@example.com', name: 'Rider Three', interestId: 'i3' },
];

describe('mergeAudiences', () => {
  it('entrants audience ignores interest sign-ups', () => {
    const out = mergeAudiences(entrants, interest, 'entrants');
    assert.deepEqual(out.map((p) => p.email).sort(), ['rider@example.com', 'two@example.com']);
  });

  it('interest audience ignores entrants', () => {
    const out = mergeAudiences(entrants, interest, 'interest');
    assert.deepEqual(out.map((p) => p.email).sort(), ['rider@example.com', 'three@example.com']);
    assert.equal(out.find((p) => p.email === 'three@example.com')?.interestId, 'i3');
  });

  it('both dedupes by email and the entrant record wins', () => {
    const out = mergeAudiences(entrants, interest, 'both');
    assert.equal(out.length, 3);
    const shared = out.find((p) => p.email === 'rider@example.com');
    assert.equal(shared?.name, 'Rider One');
    assert.equal(shared?.interestId, undefined);
  });

  it('normalises case and whitespace', () => {
    assert.equal(normaliseEmail('  Person@Example.COM '), 'person@example.com');
  });
});
