import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { isInstalledExperience } from "@/lib/native-platform";

const EDGE = 28; // px from screen edge where a swipe may start
const MIN_DX = 80;

/**
 * Edge swipe: from the left edge rightwards goes back, from the right edge
 * leftwards goes forward. Only in the installed app, since browsers already
 * provide their own swipe and would otherwise navigate twice. Ignored on maps.
 */
export function SwipeNavigation() {
  const router = useRouter();
  useEffect(() => {
    if (!isInstalledExperience()) return;
    let start: { x: number; y: number; edge: "l" | "r" } | null = null;
    const onStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const target = e.target as Element | null;
      if (target?.closest?.(".leaflet-container,[data-no-swipe],[role='dialog']")) return;
      if (t.clientX <= EDGE) start = { x: t.clientX, y: t.clientY, edge: "l" };
      else if (t.clientX >= window.innerWidth - EDGE) start = { x: t.clientX, y: t.clientY, edge: "r" };
    };
    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);
      const s = start;
      start = null;
      if (dy > Math.abs(dx) * 0.6) return;
      if (s.edge === "l" && dx > MIN_DX && router.history.canGoBack()) router.history.back();
      else if (s.edge === "r" && dx < -MIN_DX) router.history.forward();
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [router]);
  return null;
}
