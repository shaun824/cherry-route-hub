// SSR-safe wrapper for the interactive route map. Leaflet is browser-only, so we
// lazy-load the real component and render nothing during SSR.
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { Event } from "@/lib/mock-data";

const RouteMapInner = lazy(() => import("./route-map-inner"));

type Props = {
  event: Event;
  height?: string;
  showToggles?: boolean;
  showStats?: boolean;
  /** Only render routes belonging to these day ids (undefined = all days). */
  dayIds?: string[];
};


function Skeleton({ height }: { height: string }) {
  return (
    <div
      className="animate-pulse rounded-2xl bg-secondary/50 ring-1 ring-border"
      style={{ height }}
    />
  );
}

export function RouteMap(props: Props) {
  const height = props.height ?? "360px";
  return (
    <ClientOnly fallback={<Skeleton height={height} />}>
      <Suspense fallback={<Skeleton height={height} />}>
        <RouteMapInner {...props} />
      </Suspense>
    </ClientOnly>
  );
}
