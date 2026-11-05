import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isParkingLabel, pinDirectionsUrl, routePinIsNavigable, villageSpotIsNavigable } from "./pin-navigation";

describe("parking pins are navigable", () => {
  it("gives a navigate button to any pin labelled parking", () => {
    assert.equal(routePinIsNavigable({ name: "Parking", icon: "pin" }), true);
    assert.equal(routePinIsNavigable({ name: "Main parking", icon: "pin" }), true);
    assert.equal(routePinIsNavigable({ name: "Car park", icon: "water" }), true);
    assert.equal(routePinIsNavigable({ name: "Park & Ride", icon: "pin" }), true);
  });

  it("keeps spectator points navigable", () => {
    assert.equal(routePinIsNavigable({ name: "Spectator point", icon: "spectator" }), true);
  });

  it("does not offer directions on ordinary stops", () => {
    assert.equal(routePinIsNavigable({ name: "Waterpoint 2", icon: "water" }), false);
    assert.equal(routePinIsNavigable({ name: "Park Farm feed", icon: "pin" }), false);
  });

  it("matches parking words only as whole words", () => {
    assert.equal(isParkingLabel("Parking bays"), true);
    assert.equal(isParkingLabel("Sparking"), false);
    assert.equal(isParkingLabel(undefined), false);
  });

  it("treats village parking points as navigable", () => {
    assert.equal(villageSpotIsNavigable({ title: "Truck Stop", category: "parking" }), true);
    assert.equal(villageSpotIsNavigable({ title: "Parking", category: "other" }), true);
    assert.equal(villageSpotIsNavigable({ title: "Registration", category: "registration" }), false);
  });

  it("builds a Google Maps directions link", () => {
    assert.equal(
      pinDirectionsUrl(-33.9683825, 25.6208182),
      "https://www.google.com/maps/dir/?api=1&destination=-33.9683825,25.6208182",
    );
  });
});
