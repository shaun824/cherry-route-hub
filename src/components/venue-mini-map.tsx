// SSR-safe wrapper for the venue mini map (Leaflet is browser-only).
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

const Inner = lazy(() => import("./venue-mini-map-inner"));

type Props = { lat: number; lng: number; height?: string; zoom?: number };

function Skeleton({ height }: { height: string }) {
  return <div className="animate-pulse bg-secondary/50" style={{ height }} />;
}

export function VenueMiniMap(props: Props) {
  const height = props.height ?? "176px";
  return (
    <ClientOnly fallback={<Skeleton height={height} />}>
      <Suspense fallback={<Skeleton height={height} />}>
        <Inner {...props} height={height} />
      </Suspense>
    </ClientOnly>
  );
}
