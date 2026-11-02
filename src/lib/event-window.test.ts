import { test } from "node:test";
import assert from "node:assert/strict";
import { eventEndMs, isHiddenFromBackend } from "./event-window";

const DAY_MS = 24 * 60 * 60 * 1000;

// Ride For Change 2026: starts 1 Nov, runs 9 days. On day 2 it must still
// be treated as running — the Entry Ninja sync archived it on start date
// alone and it vanished from race control mid-event.
const rideForChange = {
  event_date: "2026-11-01T05:00:00+00:00",
  days: Array.from({ length: 9 }, (_, i) => ({ id: `d${i + 1}`, label: `Day ${i + 1}`, routes: [] })),
};
const day2 = new Date("2026-11-02T08:00:00+00:00").getTime();

test("a 9-day event ends on its last day, not its first", () => {
  const start = new Date("2026-11-01T05:00:00+00:00").getTime();
  assert.equal(eventEndMs(rideForChange), start + 8 * DAY_MS);
});

test("is not hidden from crew lists on day 2", () => {
  assert.equal(isHiddenFromBackend(rideForChange, day2), false);
});

test("is not past the archive cutoff on day 2", () => {
  const cutoff = day2 - DAY_MS;
  assert.equal(eventEndMs(rideForChange) < cutoff, false);
});

test("a single-day event is past the archive cutoff two days later", () => {
  const oneDay = { event_date: "2026-11-01T05:00:00+00:00", days: [] };
  const cutoff = new Date("2026-11-03T08:00:00+00:00").getTime() - DAY_MS;
  assert.equal(eventEndMs(oneDay) < cutoff, true);
});
