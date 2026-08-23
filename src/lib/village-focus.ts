// Shared context so any card on the event page can jump the rider to the
// village map, focused on a specific spot / zone / tent at the right venue.
import { createContext } from "react";

export type VillageFocus = {
  zoneId?: string | null;
  spotId?: string | null;
  tentId?: string | null;
  venueId?: string | null;
};

export const VillageFocusContext = createContext<(f: VillageFocus) => void>(() => {});
