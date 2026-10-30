import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { crewLandingTarget } from "./crew-landing";

describe("crew landing target", () => {
  it("opens crew and admin accounts on the crew centre", () => {
    assert.equal(crewLandingTarget({ signedIn: true, isCrew: true, wantsRiderApp: false }), "/crew");
  });

  it("keeps riders on the rider home", () => {
    assert.equal(crewLandingTarget({ signedIn: true, isCrew: false, wantsRiderApp: false }), "/");
  });

  it("keeps the rider home when this session tapped Rider app in the crew bar", () => {
    assert.equal(crewLandingTarget({ signedIn: true, isCrew: true, wantsRiderApp: true }), "/");
  });

  it("does nothing for visitors who are not signed in", () => {
    assert.equal(crewLandingTarget({ signedIn: false, isCrew: true, wantsRiderApp: false }), "/");
  });
});
