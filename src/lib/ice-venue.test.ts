import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ICE_EVENT_ID, ICE_VENUE_URL, ICE_VENUE_POINT, isFixedIceVenue } from "./ice-venue";
import { buildMapLink, resolveVenuePoint } from "./map-embed";
describe("ICE fixed venue", () => {
  it("uses Shaun's exact venue and parking pin", () => {
    assert.equal(buildMapLink({ mapUrl: ICE_VENUE_URL, ...ICE_VENUE_POINT }), "https://maps.app.goo.gl/zCY3gq2oQR2SkWyWA");
    assert.deepEqual(resolveVenuePoint({ mapUrl: ICE_VENUE_URL, ...ICE_VENUE_POINT }), { lat: -33.9683825, lng: 25.6208182 });
  });
  it("keeps ICE fixed without changing other events", () => {
    assert.equal(isFixedIceVenue(ICE_EVENT_ID), true);
    assert.equal(isFixedIceVenue("other-event"), false);
  });
});