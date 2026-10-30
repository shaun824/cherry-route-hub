import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { safeAuthTarget } from "./auth-navigation";

describe("social sign-in return destination", () => {
  it("preserves the rider's same-app destination", () => {
    assert.equal(safeAuthTarget("/profile"), "/profile");
    assert.equal(safeAuthTarget("/crew?event=123"), "/crew?event=123");
  });
  it("never redirects a sign-in to another website", () => {
    for (const next of ["https://example.com", "//example.com", "/\\example.com", "/\nexample.com", undefined]) {
      assert.equal(safeAuthTarget(next), "/");
    }
  });
});