// Navigation links to a GPS point. Google's "dir" links can hang on "Loading…"
// in the iPhone Google Maps app, so we drop a pin (search) which always opens,
// and offer Apple Maps directions as a second option.
export function fmtCoords(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}
export function appleMapsUrl(lat: number, lng: number): string {
  return `https://maps.apple.com/?daddr=${lat.toFixed(6)},${lng.toFixed(6)}&dirflg=d`;
}
