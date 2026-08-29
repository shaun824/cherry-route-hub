import { useEffect } from "react";
import { useMap } from "react-leaflet";

function normaliseWheelDelta(event: WheelEvent) {
  return event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
}

/**
 * Leaflet deliberately accumulates small wheel deltas before zooming, which
 * makes a laptop trackpad pinch feel delayed. Apply each gesture immediately,
 * anchored beneath the pointer, while leaving Leaflet's touch pinch untouched.
 */
export default function VillageMapTrackpadZoom() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    map.scrollWheelZoom.disable();

    // Trackpads can emit hundreds of tiny wheel events per second. Redrawing a
    // dense village for every event makes the gesture lag behind the fingers,
    // so combine them into one map update per animation frame instead.
    let frame = 0;
    let pendingDelta = 0;
    let anchor: MouseEvent | null = null;

    const applyZoom = () => {
      frame = 0;
      const event = anchor;
      const delta = pendingDelta;
      pendingDelta = 0;
      anchor = null;
      if (!event || delta === 0) return;

      const current = map.getZoom();
      const minimum = map.getMinZoom();
      const maximum = map.getMaxZoom();
      // Pinch events have ctrlKey and generally much smaller deltas than a
      // mouse wheel, so give them substantially more gain.
      const sensitivity = event.ctrlKey ? 0.22 : 0.024;
      const change = Math.max(-2.5, Math.min(2.5, -delta * sensitivity));
      const next = Math.max(minimum, Math.min(maximum, current + change));
      if (next === current) return;

      map.setZoomAround(map.mouseEventToContainerPoint(event), next);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      pendingDelta += normaliseWheelDelta(event);
      anchor = event;
      if (!frame) frame = requestAnimationFrame(applyZoom);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      container.removeEventListener("wheel", onWheel);
    };
  }, [map]);

  return null;
}