import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { campaignCanSend, readEverlyticCampaigns } from "./everlytic-data";
describe("Everlytic campaigns", () => {
  it("reads documented collection data", () => assert.deepEqual(readEverlyticCampaigns({ collection: [{ data: { id: 12, subject: "Results", status: "composing", list_ids: [3], total_actual_sent: 0 } }] }), [{ id: "12", subject: "Results", status: "composing", hasAudience: true, sent: 0 }]));
  it("allows only composing campaigns with an audience", () => {
    const c = { id: "12", subject: "Results", status: "composing", hasAudience: true, sent: 0 };
    assert.equal(campaignCanSend(c), true);
    assert.equal(campaignCanSend({ ...c, status: "sent" }), false);
    assert.equal(campaignCanSend({ ...c, hasAudience: false }), false);
  });
});