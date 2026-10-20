import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BICYCLES_LIST, ENTRY_ALERT_LIST, mayAddMembership } from './entry-interest-audience';
describe('entry-alert audiences', () => {
  it('uses the larger Bicycles list alongside entry alerts', () => {
    assert.equal(BICYCLES_LIST, '102600'); assert.equal(ENTRY_ALERT_LIST, '145818');
  });
  it('never replaces existing list opt-outs', () => {
    assert.equal(mayAddMembership({ status: 'on', email_status: 'none' }, { email_status: 'unsubscribed' }), false);
    assert.equal(mayAddMembership({ status: 'on', email_status: 'none' }, null), true);
  });
  it('does not activate globally unsubscribed or bounced contacts', () => {
    assert.equal(mayAddMembership({ status: 'off', email_status: 'none' }, null), false);
    assert.equal(mayAddMembership({ status: 'on', email_status: 'bounced' }, null), false);
  });
});