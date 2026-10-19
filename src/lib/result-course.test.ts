import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { courseMismatch, resultCourse } from "./result-course";

describe("weekend classification", () => {
  it("excludes Hannes Kriel's Bronze 52:03.77 + 44:49.51 from Silver standings", () => {
    assert.equal(courseMismatch("Silver - Adult Weekend Warrior", [resultCourse("Day 1 Bronze Overall Results"), resultCourse("Day 2 Bronze Overall Results")].filter((c): c is string => c !== null)), true);
  });
  it("excludes a rider who switches distances across the two days", () => {
    assert.equal(courseMismatch("Silver - Adult Weekend Warrior", ["silver", "bronze"]), true);
  });
  it("keeps a rider who completes Silver on both days", () => {
    assert.equal(courseMismatch("Silver - Adult Weekend Warrior", ["silver", "silver"]), false);
  });
  it("does not exclude a fast rider just because of their time", () => {
    assert.equal(courseMismatch("Bronze - Adult Weekend Warrior", ["bronze"]), false);
  });
  it("does not combine electric and analogue courses", () => {
    assert.equal(courseMismatch("Gold - Adult Weekend Warrior", ["gold-ebike"]), true);
  });
  it("does not infer a mismatch from missing course data", () => {
    assert.equal(resultCourse("Day 1"), null);
    assert.equal(courseMismatch(null, ["bronze"]), false);
  });
});