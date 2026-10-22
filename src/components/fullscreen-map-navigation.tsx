import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Crosshair, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProgressResult } from '@/lib/course-progress';
import { navigationZoom, travelBearing } from '@/lib/fullscreen-navigation';

type RotatingMap = L.Map & { setBearing?: (n: number) => void; getBearing?: () => number; touchRotate?: L.Handler };
export type NavigationFix = { lat: number; lng: number; heading?: number | null };

export function useFullscreenMapNavigation(map: L.Map | null, active: boolean, fix: NavigationFix | null) {
  const [paused, setPaused] = useState(false);
  const [resumeKey, setResumeKey] = useState(0);
  const moving = useRef(false);
  const anchor = useRef<NavigationFix | null>(null);
  const heading = useRef<number | null>(null);
  const opened = useRef(false);
  useEffect(() => {
    if (!map || !active) return;
    const rotating = map as RotatingMap;
    const bearing = rotating.getBearing?.() ?? 0;
    const centre = map.getCenter(), zoom = map.getZoom();
    const dragging = map.dragging.enabled();
    const container = map.getContainer(), touchAction = container.style.touchAction;
    rotating.touchRotate?.enable();
    map.dragging.enable();
    container.style.touchAction = 'none';
    setPaused(false); opened.current = false; anchor.current = null; heading.current = null;
    const pause = () => { if (!moving.current) setPaused(true); };
    const touch = (e: TouchEvent) => { if (e.touches.length >= 2) setPaused(true); };
    map.on('dragstart zoomstart', pause);
    container.addEventListener('touchstart', touch, { passive: true });
    return () => {
      map.off('dragstart zoomstart', pause);
      container.removeEventListener('touchstart', touch);
      rotating.touchRotate?.disable();
      container.style.touchAction = touchAction;
      if (!dragging) map.dragging.disable();
      moving.current = true;
      rotating.setBearing?.(bearing);
      map.setView(centre, zoom, { animate: false });
      moving.current = false;
      opened.current = false;
    };
  }, [map, active]);
  useEffect(() => {
    if (!map || !active || !fix || paused) return;
    const rotating = map as RotatingMap;
    moving.current = true;
    map.invalidateSize();
    if (fix.heading != null && Number.isFinite(fix.heading)) heading.current = fix.heading;
    else if (anchor.current && L.latLng(anchor.current).distanceTo([fix.lat, fix.lng]) >= 8) {
      heading.current = travelBearing(anchor.current, fix); anchor.current = fix;
    }
    anchor.current ??= fix;
    if (heading.current != null) rotating.setBearing?.(-heading.current);
    const zoom = opened.current ? map.getZoom() : navigationZoom(fix.lat, map.getSize().y);
    map.setView([fix.lat, fix.lng], zoom, { animate: false });
    // Leave more route ahead visible, with the pin in the lower third.
    map.panBy([0, -map.getSize().y * 0.18], { animate: false });
    opened.current = true;
    moving.current = false;
  }, [map, active, fix?.lat, fix?.lng, fix?.heading, paused, resumeKey]);
  return { paused, resume: () => { opened.current = false; setPaused(false); setResumeKey(k => k + 1); } };
}

export function FullscreenNavigationBar({ fix, progress, routeName, paused, onResume, error }: {
  fix: NavigationFix | null; progress: ProgressResult | null; routeName?: string; paused: boolean; onResume: () => void; error?: string | null;
}) {
  return <div aria-label="Route navigation progress" className="shrink-0 border-t border-border bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-card-foreground">
    <div className="flex items-center gap-3">
      <Navigation className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-muted-foreground">{routeName ?? 'Route navigation'}</p>
        <p className="text-sm font-bold tabular-nums">{!fix ? error ?? 'Finding your location…' : !progress ? 'Select a route to see progress' : progress.offCourseM > 300 ? `Off route · ${Math.round(progress.offCourseM)} m away` : `${(progress.alongM / 1000).toFixed(1)} km into route · ${((progress.totalM - progress.alongM) / 1000).toFixed(1)} km to finish`}</p>
      </div>
      <Button size="icon" variant={paused ? 'default' : 'outline'} aria-label="Re-centre navigation" title="Re-centre navigation" onClick={onResume}><Crosshair className="h-5 w-5" /></Button>
    </div>
    {progress && progress.offCourseM <= 300 ? <progress aria-label="Route completed" className="mt-2 h-1.5 w-full accent-primary" max={100} value={progress.pct} /> : null}
  </div>;
}