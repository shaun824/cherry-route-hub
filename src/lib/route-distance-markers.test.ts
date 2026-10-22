import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { routeDistanceMarkers } from './route-distance-markers';
import { haversineMeters, type LatLngAlt } from './geo';

describe('route kilometre markers', () => {
  it('places markers every 5 km measured from the original start', () => {
    const start: LatLngAlt = [0, 0];
    const markers = routeDistanceMarkers([[start, [0.2, 0]]]);
    assert.deepEqual(markers.map(m => m.km), [5, 10, 15, 20]);
    for (const marker of markers) assert.ok(Math.abs(haversineMeters(start, marker.coord) - marker.km * 1000) < 0.01);
  });
  it('does not restart numbering or measure gaps at section boundaries', () => {
    const firstEnd: LatLngAlt = [0.07, 0];
    const secondStart: LatLngAlt = [1, 0];
    const markers = routeDistanceMarkers([[[0, 0], firstEnd], [], [secondStart, [1.14, 0]]]);
    assert.deepEqual(markers.map(m => m.km), [5, 10, 15, 20]);
    const ten = markers.find(m => m.km === 10);
    assert.ok(ten);
    assert.ok(Math.abs(haversineMeters([0, 0], firstEnd) + haversineMeters(secondStart, ten.coord) - 10000) < 0.01);
  });
  it('keeps each route independent and tolerates repeated points', () => {
    assert.deepEqual(routeDistanceMarkers([[[0, 0], [0, 0], [0.1, 0]]]).map(m => m.km), [5, 10]);
    assert.deepEqual(routeDistanceMarkers([[[1, 0], [1.1, 0]]]).map(m => m.km), [5, 10]);
    assert.deepEqual(routeDistanceMarkers([[], [[0, 0]]]), []);
  });
});