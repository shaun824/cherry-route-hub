import { test } from "node:test";
import assert from "node:assert/strict";
import { isAvailabilityFresh } from "./class-availability.server";

const now = Date.parse("2026-11-14T03:09:00Z");

test("entry availability refreshes after five minutes, not after a full day", () => {
  assert.equal(isAvailabilityFresh("2026-11-14T03:04:01Z", now), true);
  assert.equal(isAvailabilityFresh("2026-11-14T03:04:00Z", now), false);
  assert.equal(isAvailabilityFresh("2026-11-13T08:32:26.296Z", now), false);
});

test("invalid and future timestamps cannot keep counts cached", () => {
  assert.equal(isAvailabilityFresh("invalid", now), false);
  assert.equal(isAvailabilityFresh("2026-11-15T03:09:00Z", now), false);
});