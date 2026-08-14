import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/is-admin";

/** Staff/admin traffic is never recorded — reports must show riders only. */
let adminCheck: Promise<boolean> | null = null;
let adminForUser: string | null = null;

async function isStaff(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  if (adminForUser !== userId) {
    adminForUser = userId;
    adminCheck = checkIsAdmin(supabase);
  }
  return (await adminCheck) ?? false;
}


const SESSION_KEY = "rce_analytics_session";

function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return "anon";
  }
}

function deviceType(width: number): "mobile" | "tablet" | "desktop" {
  if (width < 768) return "mobile";
  if (width < 1180) return "tablet";
  return "desktop";
}

/** Collapse dynamic ids so paths group nicely in reports. */
export function routeLabel(pathname: string): string {
  return pathname
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    .replace(/\/\d+/g, "/:id");
}

type TrackInput = {
  eventName: string;
  path?: string;
  durationMs?: number | null;
  props?: Record<string, unknown>;
};

export async function track({ eventName, path, durationMs, props }: TrackInput) {
  if (typeof window === "undefined") return;
  try {
    const { data } = await supabase.auth.getSession();
    const pathname = path ?? window.location.pathname;
    await supabase.from("analytics_events").insert({
      session_id: getSessionId(),
      user_id: data.session?.user.id ?? null,
      event_name: eventName,
      path: pathname,
      route_label: routeLabel(pathname),
      referrer: document.referrer || null,
      duration_ms: durationMs ?? null,
      viewport_width: window.innerWidth,
      device: deviceType(window.innerWidth),
      user_agent: navigator.userAgent.slice(0, 300),
      props: (props ?? {}) as never,
    });
  } catch {
    /* analytics must never break the app */
  }
}

/** Records a pageview per route change, plus the time spent on the previous page. */
export function usePageTracking() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const startedAt = useRef<number>(0);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;

    const now = Date.now();
    if (previous.current && startedAt.current) {
      void track({
        eventName: "page_exit",
        path: previous.current,
        durationMs: now - startedAt.current,
      });
    }
    previous.current = pathname;
    startedAt.current = now;
    void track({ eventName: "pageview", path: pathname });

    const onHide = () => {
      if (document.visibilityState === "hidden" && previous.current && startedAt.current) {
        void track({
          eventName: "page_exit",
          path: previous.current,
          durationMs: Date.now() - startedAt.current,
        });
        startedAt.current = 0;
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [pathname]);
}
