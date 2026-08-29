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

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();

      const delta = normaliseWheelDelta(event);
      const sensitivity = event.ctrlKey ? 0.08 : 0.012;
      const change = Math.max(-1.25, Math.min(1.25, -delta * sensitivity));
      const current = map.getZoom();
      const minimum = map.getMinZoom();
      const maximum = map.getMaxZoom();
      const next = Math.max(minimum, Math.min(maximum, current + change));

      if (next === current) return;
      const point = map.mouseEventToContainerPoint(event);
      map.setZoomAround(point, next);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, [map]);

  return null;
}