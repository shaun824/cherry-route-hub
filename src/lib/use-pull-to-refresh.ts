import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

const TRIGGER_DISTANCE = 80;
const MAX_PULL = 120;

/**
 * Native-app style pull-to-refresh: when the page is scrolled to the very
 * top and the user drags down past a threshold, the router + all queries
 * are invalidated so fresh data loads without closing/reopening the app.
 */
export function usePullToRefresh() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (window.scrollY <= 0 && e.touches.length === 1) {
        startY.current = e.touches[0]!.clientY;
        pulling.current = true;
      } else {
        pulling.current = false;
        startY.current = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || startY.current === null) return;
      const dy = e.touches[0]!.clientY - startY.current;
      if (window.scrollY > 0 || dy <= 0) {
        setPull(0);
        return;
      }
      // Dampen the pull so it feels elastic.
      const dampened = Math.min(MAX_PULL, dy * 0.5);
      setPull(dampened);
    };

    const onTouchEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      startY.current = null;
      if (pull >= TRIGGER_DISTANCE && !refreshing) {
        setRefreshing(true);
        setPull(0);
        void Promise.all([
          router.invalidate(),
          queryClient.invalidateQueries(),
        ]).finally(() => {
          // Keep the spinner visible briefly so it doesn't flicker.
          setTimeout(() => setRefreshing(false), 400);
        });
      } else {
        setPull(0);
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [pull, refreshing, router, queryClient]);

  return { pull, refreshing };
}
