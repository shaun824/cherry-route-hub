import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PRECOMPUTED_ROUTE_ELEVATIONS } from "./precomputed-route-elevations";

describe("PE Plett 2027 stage profiles", () => {
  for (const s of [1, 2, 3, 4]) {
    it(`stage ${s} has a stored profile so it never depends on live terrain lookups`, () => {
      const p = PRECOMPUTED_ROUTE_ELEVATIONS[`pe-plett-2027-stage-${s}.kml`];
      assert.equal(p?.length, 201);
      assert.ok(p.every((v) => Number.isFinite(v)));
    });
  }
});
