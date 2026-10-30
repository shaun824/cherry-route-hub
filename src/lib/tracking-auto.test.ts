import { test } from "node:test";
import assert from "node:assert/strict";
import { uploadIntervalMs, sustainedMovement, leftVillage, sastTimeMs, batchStartTime, BATCH_REMINDER_LEAD_MS } from "./tracking-auto";

const NOW = 1_800_000_000_000;

test("riding uploads every 10 seconds", () => {
  assert.equal(uploadIntervalMs(NOW - 60_000, NOW), 10_000);
});

test("standing still for 5 minutes slows uploads to 60 seconds", () => {
  assert.equal(uploadIntervalMs(NOW - 5 * 60_000, NOW), 60_000);
  assert.equal(uploadIntervalMs(NOW - 4 * 60_000, NOW), 10_000);
});

const samples = (kph: number, spanMs: number) =>
  Array.from({ length: spanMs / 10_000 + 1 }, (_, i) => ({ at: NOW - spanMs + i * 10_000, kph }));

test("auto-start after 2 minutes above 10 km/h", () => {
  assert.equal(sustainedMovement(samples(18, 120_000), NOW), true);
});

test("no auto-start after only 1 minute of movement", () => {
  assert.equal(sustainedMovement(samples(18, 60_000), NOW), false);
});

test("no auto-start at walking pace", () => {
  assert.equal(sustainedMovement(samples(8, 180_000), NOW), false);
});

test("geofence fires only after leaving the village", () => {
  assert.equal(leftVillage(true, 1_200, 1_000), true);
  assert.equal(leftVillage(true, 800, 1_000), false);
  assert.equal(leftVillage(false, 5_000, 1_000), false);
});

test("batch reminder is 15 minutes before a SAST start time", () => {
  const start = sastTimeMs("2026-11-01", "07:30");
  assert.equal(start, Date.parse("2026-11-01T05:30:00Z"));
  assert.equal(BATCH_REMINDER_LEAD_MS, 15 * 60_000);
  assert.equal(batchStartTime([{ name: "Wave 1", startTime: "07:30" }], " wave 1"), "07:30");
});
