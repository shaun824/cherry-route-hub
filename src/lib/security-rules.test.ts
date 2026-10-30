import { describe, it } from "node:test";
import assert from "node:assert/strict";
const expect = (actual: unknown) => ({ toBe: (expected: unknown) => assert.equal(actual, expected), toEqual: (expected: unknown) => assert.deepEqual(actual, expected) });
import { csvCell, canPublishTracking, canReadResults, validFieldExpiry, privatePeerStats } from "./security-rules";

describe("rider privacy boundaries", () => {
  it("denies missing, private, review and spectator-disabled location feeds", () => {
    expect(canPublishTracking(null)).toBe(false);
    expect(canPublishTracking({ spectator_mode: false })).toBe(false);
    expect(canPublishTracking({ spectator_mode: true, is_review_event: true })).toBe(false);
    expect(canPublishTracking({ spectator_mode: true, is_public: false })).toBe(false);
    expect(canPublishTracking({ spectator_mode: true, is_review_event: false })).toBe(true);
  });
  it("keeps unpublished results private while allowing staff preview", () => {
    expect(canReadResults(false, false)).toBe(false);
    expect(canReadResults(false, true)).toBe(true);
    expect(canReadResults(true, false)).toBe(true);
  });
  it("rejects expired and legacy ten-year field links", () => {
    const now = 1_800_000_000_000;
    expect(validFieldExpiry(now - 1, now)).toBe(false);
    expect(validFieldExpiry(now, now)).toBe(false);
    expect(validFieldExpiry(now + 3_650 * 86400000, now)).toBe(false);
    expect(validFieldExpiry(now + 86400000, now)).toBe(true);
  });
  it("does not reveal segment times from fewer than three peers", () => {
    expect(privatePeerStats([120])).toEqual({ best: null, average: null });
    expect(privatePeerStats([120, 140])).toEqual({ best: null, average: null });
    expect(privatePeerStats([120, 140, 160])).toEqual({ best: 120, average: 140 });
  });
});

describe("spreadsheet export security", () => {
  for (const text of ["=HYPERLINK(\"https://evil.test\")", "+1", "-1", "@SUM(A1)", "  =1", "\t=1", "\r=1", "\u0000=1"]) {
    it(`neutralizes formula prefix ${JSON.stringify(text)}`, () => {
      expect(csvCell(text).startsWith('"\'')).toBe(true);
    });
  }
  it("preserves ordinary data and quotes safely", () => {
    expect(csvCell('Rider, "A"')).toBe('"Rider, ""A"""');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(753)).toBe('"753"');
  });
});