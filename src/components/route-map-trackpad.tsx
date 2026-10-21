import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

/** Trackpad scrolling pans; a trackpad pinch zooms about the pointer.
 * Touch and mouse dragging remain owned by Leaflet. */
export default function RouteMapTrackpad() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    map.scrollWheelZoom.disable();
    let frame = 0;
    let panX = 0;
    let panY = 0;
    let zoomDelta = 0;
    let anchor: L.Point | null = null;

    const apply = () => {
      frame = 0;
      if (panX || panY) map.panBy([panX, panY], { animate: false });
      if (zoomDelta && anchor) {
        const next = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + zoomDelta));
        map.setZoomAround(anchor, next, { animate: false });
      }
      panX = 0;
      panY = 0;
      zoomDelta = 0;
      anchor = null;
    };

    const onWheel = (event: WheelEvent) => {
      // Don't steal scrolling from popup content or the map's controls.
      if (event.target instanceof Element && event.target.closest(".leaflet-control, .leaflet-popup")) return;
      event.preventDefault();
      event.stopPropagation();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientHeight : 1;
      if (event.ctrlKey || event.metaKey) {
        // Zoom is logarithmic in Leaflet, so delta-proportional zoom gives an
        // exponential scale without multiplying once per trackpad event.
        zoomDelta -= event.deltaY * unit * 0.006;
        anchor = map.mouseEventToContainerPoint(event);
      } else {
        panX += event.deltaX * unit;
        panY += event.deltaY * unit;
      }
      if (!frame) frame = requestAnimationFrame(apply);
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(frame);
      container.removeEventListener("wheel", onWheel);
    };
  }, [map]);

  return null;
}