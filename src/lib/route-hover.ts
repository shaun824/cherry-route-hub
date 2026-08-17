// Tiny cross-component store so the elevation profile can tell the route map
// which point on the route the rider is currently hovering.
import { useSyncExternalStore } from "react";

export type RouteHover = { routeId: string; lat: number; lng: number; km: number } | null;

let current: RouteHover = null;
const listeners = new Set<() => void>();

export function setRouteHover(next: RouteHover) {
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useRouteHover(): RouteHover {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
