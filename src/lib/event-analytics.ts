// In-event analytics: which tabs riders open, which Info/Profile sections they
// actually read, and what they tap. Everything is fire-and-forget through the
// batched `track()` queue; no personal data or message text is ever recorded.
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

export type TabSource = "tab_bar" | "quick_link" | "deep_link" | "village_focus" | "initial" | "back";

type Scope = { event_id?: string; event_name?: string; tab?: string };
let scope: Scope = {};

export function setAnalyticsScope(next: Scope) {
  scope = next;
}
export function getAnalyticsScope(): Scope {
  return scope;
}

/** Log a key action with the current event/tab attached. Details must be non-personal. */
export function trackAction(action: string, details?: Record<string, string | number | boolean | null | undefined>) {
  try {
    track({ eventName: "action", props: { ...scope, action, ...(details ?? {}) } });
  } catch {
    /* never throw */
  }
}

const throttles = new Map<string, number>();
/** Same as trackAction but at most once per `ms` for the same key (e.g. map pans). */
export function trackActionThrottled(action: string, ms = 15000, details?: Record<string, string | number | boolean | null>) {
  const key = `${scope.event_id}:${scope.tab}:${action}`;
  const now = Date.now();
  if ((throttles.get(key) ?? 0) + ms > now) return;
  throttles.set(key, now);
  trackAction(action, details);
}

/**
 * Fires tab_view on every tab shown and tab_exit (with dwell) on leaving —
 * tab switch, unmount/navigation, or the page going hidden.
 */
export function useTabTracking(eventId: string, eventName: string, tab: string, source: TabSource) {
  const startedAt = useRef(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setAnalyticsScope({ event_id: eventId, event_name: eventName, tab });
    startedAt.current = Date.now();
    track({ eventName: "tab_view", props: { event_id: eventId, event_name: eventName, tab, source } });

    const exit = () => {
      if (!startedAt.current) return;
      track({
        eventName: "tab_exit",
        durationMs: Date.now() - startedAt.current,
        props: { event_id: eventId, event_name: eventName, tab },
      });
      startedAt.current = 0;
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") exit();
      else if (!startedAt.current) startedAt.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      exit();
      setAnalyticsScope({});
    };
    // source intentionally excluded — it describes how this tab was reached.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, eventName, tab]);
}

/**
 * Watches every `[data-section]` element inside the container. A section that
 * is ≥50% visible for 1s logs `section_view` once per visit, and its dwell time
 * is logged as `section_exit` when it leaves view. New sections that mount
 * later (lazy cards) are picked up automatically.
 */
export function useSectionTracking(
  containerRef: React.RefObject<HTMLElement | null>,
  visitKey: string,
  extra: Record<string, string | undefined> = {},
) {
  const extraKey = JSON.stringify(extra);
  useEffect(() => {
    const root = containerRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const seen = new Set<string>();
    const pending = new Map<string, number>();
    const visibleSince = new Map<string, number>();
    const props = () => ({ ...scope, ...JSON.parse(extraKey) });

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const name = (e.target as HTMLElement).dataset.section;
          if (!name) continue;
          if (e.isIntersecting && e.intersectionRatio >= 0.5) {
            if (seen.has(name) || pending.has(name)) continue;
            pending.set(
              name,
              window.setTimeout(() => {
                pending.delete(name);
                seen.add(name);
                visibleSince.set(name, Date.now());
                track({ eventName: "section_view", props: { ...props(), section: name } });
              }, 1000),
            );
          } else {
            const t = pending.get(name);
            if (t) {
              window.clearTimeout(t);
              pending.delete(name);
            }
            const since = visibleSince.get(name);
            if (since) {
              visibleSince.delete(name);
              track({ eventName: "section_exit", durationMs: Date.now() - since, props: { ...props(), section: name } });
            }
          }
        }
      },
      { threshold: [0, 0.5] },
    );
    const observed = new WeakSet<Element>();
    const scan = () => {
      root.querySelectorAll("[data-section]").forEach((el) => {
        if (observed.has(el)) return;
        observed.add(el);
        io.observe(el);
      });
    };
    scan();
    let raf = 0;
    const mo = new MutationObserver(() => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        scan();
      });
    });
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io.disconnect();
      pending.forEach((t) => window.clearTimeout(t));
      visibleSince.forEach((since, name) =>
        track({ eventName: "section_exit", durationMs: Date.now() - since, props: { ...props(), section: name } }),
      );
    };
  }, [containerRef, visitKey, extraKey]);
}

function classifyOutbound(href: string): string | null {
  let u: URL;
  try {
    u = new URL(href, window.location.href);
  } catch {
    return null;
  }
  if (u.protocol === "tel:") return "phone";
  if (u.protocol === "mailto:") return "email";
  if (u.origin === window.location.origin) return null;
  const h = u.hostname;
  if (/wa\.me|whatsapp/.test(h)) return "whatsapp";
  if (/entryninja/.test(h)) return "entry_ninja";
  if (/instagram|facebook|fb\.com|tiktok|youtube|twitter|x\.com|strava/.test(h)) return "social";
  if (/google\.[a-z.]+$/.test(h) && u.pathname.startsWith("/maps") || /maps\.(google|apple)/.test(h)) return "maps";
  if (/weather|yr\.no|windy|open-meteo/.test(h)) return "weather";
  return "website";
}

/**
 * One delegated click listener: records outbound links, file downloads and any
 * element marked with `data-track-action` (plus `data-track-*` details).
 */
export function useClickTracking(containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onClick = (ev: MouseEvent) => {
      try {
        const target = ev.target as HTMLElement | null;
        const marked = target?.closest<HTMLElement>("[data-track-action]");
        if (marked && root.contains(marked)) {
          const details: Record<string, string> = {};
          for (const [k, v] of Object.entries(marked.dataset)) {
            if (k.startsWith("track") && k !== "trackAction" && v) {
              details[k.slice(5).replace(/^./, (c) => c.toLowerCase())] = v.slice(0, 80);
            }
          }
          trackAction(marked.dataset.trackAction!, details);
          if (marked.tagName !== "A") return;
        }
        const a = target?.closest<HTMLAnchorElement>("a[href]");
        if (!a || !root.contains(a)) return;
        if (a.hasAttribute("download")) {
          const file = a.getAttribute("download") || a.href.split("/").pop() || "";
          const ext = (file.split(".").pop() || "").toLowerCase().slice(0, 5);
          const ctx = a.closest<HTMLElement>("[data-day]");
          trackAction("file_download", { file_type: ext, label: file.slice(0, 80), day: ctx?.dataset.day, route: ctx?.dataset.route });
          return;
        }
        const kind = classifyOutbound(a.href);
        if (kind) {
          let host = "";
          try {
            host = new URL(a.href).hostname;
          } catch {
            /* ignore */
          }
          trackAction("outbound_click", { target: kind, host: kind === "phone" || kind === "email" ? undefined : host });
        }
      } catch {
        /* never throw */
      }
    };
    root.addEventListener("click", onClick, { capture: true });
    return () => root.removeEventListener("click", onClick, { capture: true });
  }, [containerRef]);
}
