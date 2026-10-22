import { haversineMeters, type LatLngAlt } from './geo';
import type { ProgressResult } from './course-progress';

export const NAVIGATION_CAMERA_HEIGHT_M = 120;
/** A 45° vertical camera's ground footprint; Leaflet has scale, not altitude. */
export function navigationZoom(lat: number, viewportHeight: number) {
  const groundSpan = 2 * NAVIGATION_CAMERA_HEIGHT_M * Math.tan(Math.PI / 8);
  const metresPerPixel = groundSpan / Math.max(240, viewportHeight);
  return Math.max(15, Math.min(20, Math.log2(156543.03392 * Math.cos(lat * Math.PI / 180) / metresPerPixel)));
}

/** Project onto segments, counting every track section without bridging gaps. */
export function navigationProgress(lines: LatLngAlt[][], lat: number, lng: number): ProgressResult | null {
  let totalM = 0, alongM = 0, offCourseM = Infinity;
  const cos = Math.cos(lat * Math.PI / 180);
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      const ax = (a[0] - lng) * cos, ay = a[1] - lat;
      const dx = (b[0] - a[0]) * cos, dy = b[1] - a[1];
      const length = haversineMeters(a, b);
      const f = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
      const distance = haversineMeters([lng, lat], [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      if (distance < offCourseM) { offCourseM = distance; alongM = totalM + length * f; }
      totalM += length;
    }
  }
  return totalM > 0 ? { alongM, totalM, offCourseM, pct: alongM / totalM * 100 } : null;
}

export function travelBearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lng - a.lng) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}