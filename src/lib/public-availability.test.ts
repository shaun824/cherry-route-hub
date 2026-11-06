import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAvailability } from "./public-availability";

const classes = [
  { id: "c1", label: "Trip 1", capacity: 30 },
  { id: "c2", label: "Trip 2" },
];

test("remaining is capacity minus sold, never below zero", () => {
  const cats = Array(32).fill("Trip 1");
  const r = buildAvailability("x", null, classes, cats);
  assert.equal(r.classes[0].sold, 32);
  assert.equal(r.classes[0].remaining, 0);
});

test("remaining is null when no capacity is set", () => {
  const r = buildAvailability("x", null, classes, ["Trip 2"]);
  assert.equal(r.classes[1].remaining, null);
  assert.equal(r.capacity, null);
  assert.equal(r.remaining, null);
});

test("event-level capacity shares one limit across classes", () => {
  const r = buildAvailability("x", 40, classes, ["Trip 1", "Trip 2", "Trip 2"]);
  assert.equal(r.sold, 3);
  assert.equal(r.remaining, 37);
});

test("class names match despite trailing full stop from Entry Ninja", () => {
  const r = buildAvailability("x", null, classes, ["Trip 1."]);
  assert.equal(r.classes[0].sold, 1);
});
