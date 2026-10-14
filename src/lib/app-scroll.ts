// On phones the page itself never scrolls (iOS 26 Safari misplaces fixed bars
// while its toolbar collapses). Instead #app-scroll is the scroller and the
// menus are ordinary flow children of a one-screen-tall frame. These helpers
// target whichever element is actually scrolling.
export const APP_SCROLL_ID = "app-scroll";

export function getScroller(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const el = document.getElementById(APP_SCROLL_ID);
  if (!el) return null;
  const oy = getComputedStyle(el).overflowY;
  return oy === "auto" || oy === "scroll" ? el : null;
}

export function getScrollTop(): number {
  const el = getScroller();
  return el ? el.scrollTop : typeof window === "undefined" ? 0 : window.scrollY;
}

export function scrollAppTo(top: number, behavior: ScrollBehavior = "auto") {
  const el = getScroller();
  if (el) el.scrollTo({ top, behavior });
  else if (typeof window !== "undefined") window.scrollTo({ top, behavior });
}

/** Top offset (in viewport px) of the scrolling area — 0 when the window scrolls. */
export function scrollerViewportTop(): number {
  const el = getScroller();
  return el ? el.getBoundingClientRect().top : 0;
}
