import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NAVIGATION_CAMERA_HEIGHT_M, navigationZoom, navigationProgress, travelBearing } from './fullscreen-navigation';
describe('fullscreen navigation rules', () => {
  it('opens at a 120 metre camera-height equivalent', () => {
    assert.equal(NAVIGATION_CAMERA_HEIGHT_M, 120);
    const zoom = navigationZoom(-32, 600);
    const span = 156543.03392 * Math.cos(-32 * Math.PI / 180) / 2 ** zoom * 600;
    assert.ok(Math.abs(span - 2 * 120 * Math.tan(Math.PI / 8)) < 0.01);
  });
  it('shows distance into and remaining across all sections without joining gaps', () => {
    const p = navigationProgress([[[0, 0], [0.01, 0]], [[0.03, 0], [0.04, 0]]], 0, 0.035);
    assert.ok(p);
    assert.ok(Math.abs(p.pct - 75) < 0.01);
    assert.ok(Math.abs((p.totalM - p.alongM) - 556) < 2);
  });
  it('turns the travel direction north or east up', () => {
    assert.equal(travelBearing({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }), 0);
    assert.equal(travelBearing({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }), 90);
  });
});