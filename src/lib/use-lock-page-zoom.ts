import { useEffect } from "react";

/**
 * Locks the whole page at scale 1 while mounted (village map screens): pinch
 * gestures must drive the map, never the browser's page zoom, and the page
 * must stay full-screen sized. Restores the original viewport meta on
 * unmount so the rest of the app keeps its normal behaviour.
 */
export function useLockPageZoom() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    const previous = meta?.getAttribute("content") ?? null;
    meta?.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
    );

    // iOS Safari fires gesture events for page pinch — cancel them outright.
    const onGesture = (e: Event) => e.preventDefault();
    // Any two-finger move that reaches the document (started half-off the map)
    // would pinch the page; the map's own container handles its gestures first.
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("gesturestart", onGesture, { passive: false });
    document.addEventListener("gesturechange", onGesture, { passive: false });
    document.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      if (meta) {
        if (previous) meta.setAttribute("content", previous);
        else meta.removeAttribute("content");
      }
      document.removeEventListener("gesturestart", onGesture);
      document.removeEventListener("gesturechange", onGesture);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, []);
}
