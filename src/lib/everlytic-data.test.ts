import { describe, expect, it } from "vitest";
import { campaignCanSend, readEverlyticCampaigns } from "./everlytic-data";
describe("Everlytic campaigns", () => {
  it("reads documented collection data", () => expect(readEverlyticCampaigns({ collection: [{ data: { id: 12, subject: "Results", status: "composing", list_ids: [3], total_actual_sent: 0 } }] })).toEqual([{ id: "12", subject: "Results", status: "composing", hasAudience: true, sent: 0 }]));
  it("allows only composing campaigns with an audience", () => {
    const c = { id: "12", subject: "Results", status: "composing", hasAudience: true, sent: 0 };
    expect(campaignCanSend(c)).toBe(true);
    expect(campaignCanSend({ ...c, status: "sent" })).toBe(false);
    expect(campaignCanSend({ ...c, hasAudience: false })).toBe(false);
  });
});