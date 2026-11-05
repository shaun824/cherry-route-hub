// Which map pins riders and spectators can drive to.
//
// Two kinds of pin carry a "Navigate" button on the route map and the village
// map: spectator points (explicitly placed for navigation), and any pin whose
// label says it is parking. The label rule means an admin who renames a pin to
// "Parking" gets the button without having to switch pin types.
import type { CustomMarker } from "@/lib/mock-data";
import type { VillageHotspot } from "@/lib/village-map";

/** "Parking", "Main parking", "Car park", "Park & Ride" — but not "Park Farm". */
const PARKING_LABEL = /\bparking\b|\bcar park\b|\bpark\s*(?:&|and)\s*ride\b/i;

export function isParkingLabel(label: string | null | undefined): boolean {
  return !!label && PARKING_LABEL.test(label);
}

/** A route-map pin riders can get driving directions to. */
export function routePinIsNavigable(pin: Pick<CustomMarker, "name" | "icon">): boolean {
  return pin.icon === "spectator" || pin.icon === "parking" || isParkingLabel(pin.name);
}

/** A village-map point riders and spectators can get driving directions to. */
export function villageSpotIsNavigable(spot: Pick<VillageHotspot, "title" | "category">): boolean {
  return spot.category === "parking" || isParkingLabel(spot.title);
}

/** Google Maps driving directions to a pin. */
export function pinDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
