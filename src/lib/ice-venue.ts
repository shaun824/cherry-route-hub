export const ICE_EVENT_ID = "f046ce38-e687-4038-959d-271ba20825f0";
export const ICE_VENUE_URL = "https://maps.app.goo.gl/zCY3gq2oQR2SkWyWA";
export const ICE_VENUE_POINT = { lat: -33.9683825, lng: 25.6208182 };
export function isFixedIceVenue(eventId: string): boolean {
  return eventId === ICE_EVENT_ID;
}