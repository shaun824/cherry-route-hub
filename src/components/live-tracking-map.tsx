// Lazy wrapper: the Leaflet map only loads in the browser.
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import type { ProgressResult } from "@/lib/course-progress";

const LiveTrackingMapInner = lazy(() => import("./live-tracking-map-inner"));

export function LiveTrackingMap({
  eventId,
  isCrew,
  focusUserId,
  onOffCourse,
  riderMode,
  onFocusedProgress,
}: {
  eventId: string;
  isCrew?: boolean;
  focusUserId?: string | null;
  onOffCourse?: (map: Record<string, number>) => void;
  riderMode?: boolean;
  onFocusedProgress?: (progress: ProgressResult | null) => void;
}) {
  const fallback = (
    <div className="flex h-96 items-center justify-center rounded-2xl bg-card text-sm text-ink-soft ring-1 ring-border">
      Loading live map…
    </div>
  );
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <LiveTrackingMapInner
          eventId={eventId}
          isCrew={isCrew}
          focusUserId={focusUserId}
          onOffCourse={onOffCourse}
          riderMode={riderMode}
          onFocusedProgress={onFocusedProgress}
        />
      </Suspense>

    </ClientOnly>
  );
}
