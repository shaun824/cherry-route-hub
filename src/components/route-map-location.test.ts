import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Route viewing must never ask where the rider is. Only the tracking page and
// race control may use the device location, so these files are checked by hand.
function source(name: string) {
  return readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");
}

describe("route viewing does not ask for location", () => {
  const routeMap = source("./route-map-inner.tsx");

  it("never calls the device location from the route map", () => {
    assert.equal(routeMap.includes("navigator.geolocation"), false);
    assert.equal(routeMap.includes("watchPosition"), false);
    assert.equal(routeMap.includes("getCurrentPosition"), false);
  });

  it("shows no location switch or location warning on the route map", () => {
    assert.equal(routeMap.includes("Location on"), false);
    assert.equal(routeMap.includes("Location off"), false);
    assert.equal(routeMap.includes("Location is off"), false);
  });

  it("keeps the location feature on the tracking page", () => {
    assert.equal(source("./tracker-panel.tsx").includes("navigator.geolocation"), true);
  });

  it("keeps the location feature on the race control map", () => {
    assert.equal(source("./live-tracking-map-inner.tsx").includes("navigator.geolocation"), true);
  });
});
