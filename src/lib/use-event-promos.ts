import { useMemo } from "react";
import { useAdminStore } from "./store";
import { eventPromosFrom, type EventPromo } from "./event-promos";

/** Admin-managed rider offers for an event (blank keyword list = all events). */
export function useEventPromos(eventName: string | null | undefined): EventPromo[] {
  const promos = useAdminStore((s) => s.promos);
  return useMemo(() => eventPromosFrom(promos, eventName), [promos, eventName]);
}
