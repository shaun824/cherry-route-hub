import { haversineMeters, type LatLngAlt } from './geo';

/** Measure the original route in riding order, carrying distance across sections
 * without counting the straight-line gaps between them. */
export function routeDistanceMarkers(lines: LatLngAlt[][]) {
  const totalM = lines.reduce((sum, line) => {
    for (let i = 1; i < line.length; i++) sum += haversineMeters(line[i - 1], line[i]);
    return sum;
  }, 0);
  const markers: { km: number; coord: LatLngAlt }[] = [];
  let travelledM = 0;
  let nextM = 5000;
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      const lengthM = haversineMeters(a, b);
      if (lengthM <= 0) continue;
      while (nextM <= travelledM + lengthM && nextM < totalM - 300) {
        const fraction = (nextM - travelledM) / lengthM;
        markers.push({ km: nextM / 1000, coord: [
          a[0] + (b[0] - a[0]) * fraction,
          a[1] + (b[1] - a[1]) * fraction,
        ] });
        nextM += 5000;
      }
      travelledM += lengthM;
    }
  }
  return markers;
}