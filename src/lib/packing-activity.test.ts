import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { activityPackingList, normalisePackingTerms } from "./packing-activity";

describe("activity packing", () => {
  it("replaces legacy tape wording while preserving checklist keys", () => {
    assert.deepEqual(normalisePackingTerms([{ key: "bk-gaffer", label: "Gaffer tape" }]), [{ key: "bk-gaffer", label: "Duct Tape" }]);
  });
  it("includes walking and open-water safety kit without bicycle equipment", () => {
    const items = activityPackingList("Sabrina Love Summer Challenge 2026: Beach Walk & Surf Ski") ?? [];
    assert.ok(items.some((i) => i.key === "walk-shoes"));
    for (const key of ["paddle-craft", "paddle-pfd", "paddle-leash", "paddle-whistle"]) assert.ok(items.some((i) => i.key === key && i.essential));
    assert.equal(items.some((i) => /bike|bicycle|tyre|helmet|chain|jersey/i.test(i.label)), false);
  });
  it("keeps cycling kit for the MTB day only", () => {
    assert.equal(activityPackingList("Sabrina Love Summer Challenge 2026: MTB & E-Bike"), null);
    const run = activityPackingList("Sabrina Love Summer Challenge 2026: Discovery Vitality Run") ?? [];
    assert.ok(run.some((i) => i.key === "run-shoes"));
    assert.equal(run.some((i) => /bike|tyre|chain/i.test(i.label)), false);
  });
});