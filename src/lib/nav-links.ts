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
/** Turn-by-turn driving directions from the phone's current location; Google picks the best road route. */
export function googleDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}&travelmode=driving&dir_action=navigate`;
}
/** Ask race control to drop a pin for this point on its live map. */
export const SHOW_POINT_EVENT = "rce:show-point";
export type ShowPoint = { lat: number; lng: number; label: string };
export function showPointOnRaceMap(p: ShowPoint) {
  window.dispatchEvent(new CustomEvent<ShowPoint>(SHOW_POINT_EVENT, { detail: p }));
}
