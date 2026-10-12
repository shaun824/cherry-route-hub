import { useEffect, type RefObject } from "react";

/**
 * Keeps a `position: fixed; bottom: 0` bar glued to the bottom of what the
 * user actually sees. iPhone Safari sometimes leaves fixed bottom bars stranded
 * mid-screen after its toolbar collapses or the page zoom changes; this
 * measures the bar against the visible area and nudges it back. The offset is
 * also published as --bottom-bar-shift so other bottom-pinned pills follow.
 */
export function usePinToScreenBottom(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined") return;
    const vv = window.visualViewport;
    let shift = 0;
    let frame = 0;

    const apply = () => {
      frame = 0;
      const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      const rect = el.getBoundingClientRect();
      // Where the bar would sit with no correction.
      const naturalBottom = rect.bottom - shift;
      const next = Math.round(visibleBottom - naturalBottom);
      // Ignore tiny jitter; reset fully when nothing is wrong.
      const target = Math.abs(next) < 2 ? 0 : next;
      if (target === shift) return;
      shift = target;
      const value = `${shift}px`;
      el.style.transform = shift ? `translate3d(0, ${value}, 0)` : "";
      document.documentElement.style.setProperty("--bottom-bar-shift", value);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    // Settle check after momentum scrolling / toolbar animation ends.
    let settle = 0;
    const onScroll = () => {
      schedule();
      window.clearTimeout(settle);
      settle = window.setTimeout(schedule, 180);
    };

    schedule();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    window.addEventListener("pageshow", schedule);
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("touchend", onScroll, { passive: true });
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);
    const poll = window.setInterval(schedule, 1000);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.clearInterval(poll);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.removeEventListener("pageshow", schedule);
      document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener("touchend", onScroll);
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
      el.style.transform = "";
      document.documentElement.style.removeProperty("--bottom-bar-shift");
    };
  }, [ref]);
}
