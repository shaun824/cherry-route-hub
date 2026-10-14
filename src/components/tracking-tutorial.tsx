import { getScrollTop, scrollAppTo, scrollerViewportTop } from "@/lib/app-scroll";
// Interactive first-visit tour of the tracking page: switches to each tab, spotlights the
// real feature and shows a tapping finger on what to press. Shown once per person
// (device + account); replayable from the link at the bottom of the page.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pointer, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";

const KEY = "rc-tracking-tour-v2";
export const REPLAY_EVENT = "rc-tracking-tour-replay";
export const replayTrackingTutorial = () => window.dispatchEvent(new Event(REPLAY_EVENT));

type Step = {
  tab?: "live" | "riders" | "results" | "info";
  /** Element to spotlight — first match wins. */
  target: () => Element | null;
  /** Element the finger taps (defaults to the spotlight). */
  tap?: () => Element | null;
  title: string;
  body: string;
};

const q = (sel: string) => () => document.querySelector(sel);
const first = (...fns: (() => Element | null)[]) => () => {
  for (const f of fns) {
    const el = f();
    if (el) return el;
  }
  return null;
};
const byText = (root: string, re: RegExp, tag = "button") => () => {
  const scope = document.querySelector(root);
  if (!scope) return null;
  return [...scope.querySelectorAll(tag)].find((b) => re.test(b.textContent ?? "")) ?? null;
};

const STEPS: Step[] = [
  {
    tab: "live",
    target: q('[data-tour="tabs"]'),
    tap: q('[data-tour="tab-live"]'),
    title: "Welcome to race-day HQ",
    body: "Everything for race day lives in these four tabs: the live map, the rider list, results and venue info. Let's walk through them.",
  },
  {
    tab: "live",
    target: first(q('[data-tour="tracker"]'), q('[data-tour="map"]')),
    tap: first(byText('[data-tour="tracker"]', /check my location|start tracking/i), q('[data-tour="map"]')),
    title: "Share your location",
    body: "Riding? Tap “Check my location”, then “Start tracking” about 30 minutes before your start. Add the Rider Hub to your home screen first so tracking keeps going when your screen locks.",
  },
  {
    tab: "live",
    target: first(byText('[data-tour="tracker"]', /send sos/i), q('[data-tour="tracker"]'), q('[data-tour="map"]')),
    title: "SOS if you need help",
    body: "Pick what happened, add a short note, then hold the SOS button for 2 seconds. Race control and the medics get your exact spot and your message straight away.",
  },
  {
    tab: "live",
    target: q('[data-tour="map"]'),
    title: "Watch the race live",
    body: "Rider dots move on the map every few seconds. Use the Day and route buttons to switch courses, and tap a waterpoint or sponsor to open it in Google Maps.",
  },
  {
    tab: "riders",
    target: q('[data-tour="search"]'),
    title: "Find any rider",
    body: "Search by name or race number, or filter by class. Tap a rider to see their race number, start times for each day and results.",
  },
  {
    tab: "riders",
    target: first(q('[aria-label="Star this rider"]'), q('[aria-label="Remove from starred riders"]')),
    title: "Star your friends",
    body: "Tap the star next to anyone you want to follow. Starred riders stay at the top of the list and the results, and are saved to your profile.",
  },
  {
    tab: "riders",
    target: first(byText("body", /track live/i), q('[data-tour="search"]')),
    title: "Track them live",
    body: "Tap “Track live” next to a starred rider and the map follows them around the course for you.",
  },
  {
    tab: "results",
    target: q('[data-tour="tab-results"]'),
    title: "Results & prize giving",
    body: "Times arrive here straight from the timing system. Your starred riders show at the top with their place and time, and the podium appears at prize giving.",
  },
  {
    tab: "live",
    target: q('[data-tour="replay"]'),
    title: "You're all set!",
    body: "Replay this tour any time with this link at the bottom of the page. Enjoy the race!",
  },
];

type Box = { top: number; left: number; width: number; height: number };
const boxOf = (el: Element | null): Box | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

export function TrackingTutorial({ onTab }: { onTab?: (tab: string) => void }) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [spot, setSpot] = useState<Box | null>(null);
  const [tap, setTap] = useState<Box | null>(null);
  const [vh, setVh] = useState(800);
  const lastTab = useRef<string | null>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(KEY) === "1";
    } catch {
      /* storage unavailable */
    }
    if (user?.user_metadata?.tracking_tour_v2_seen) seen = true;
    if (!seen) {
      const t = window.setTimeout(() => {
        setI(0);
        setOpen(true);
      }, 1200);
      return () => window.clearTimeout(t);
    }
  }, [user?.id]);

  useEffect(() => {
    const replay = () => {
      lastTab.current = null;
      setI(0);
      setOpen(true);
    };
    window.addEventListener(REPLAY_EVENT, replay);
    return () => window.removeEventListener(REPLAY_EVENT, replay);
  }, []);

  // Move to the step's tab, scroll the feature into view, then keep the spotlight glued to it.
  useLayoutEffect(() => {
    if (!open) return;
    const step = STEPS[i];
    // Only switch tabs when needed — switching scrolls the page to the top.
    const tabChanged = !!step.tab && step.tab !== lastTab.current;
    if (tabChanged) {
      onTab?.(step.tab!);
      lastTab.current = step.tab!;
    }
    setSpot(null);
    let scrolled = false;
    const measure = () => {
      const el = step.target();
      if (el) {
        // Keep the feature on screen (re-scroll if a tab switch jumped the page to the top).
        const r = el.getBoundingClientRect();
        const h = window.innerHeight;
        const offscreen = r.bottom < 80 || r.top > h - 80;
        if (!scrolled || offscreen) {
          scrolled = true;
          const tall = r.height > h * 0.5;
          const y = getScrollTop() + r.top - scrollerViewportTop() - (tall ? 90 : h / 2 - r.height / 2);
          scrollAppTo(Math.max(0, y), "auto");
        }
      }
      setVh(window.innerHeight);
      setSpot(boxOf(el));
      setTap(boxOf(step.tap?.() ?? el));
    };
    const scrollAgain = () => {
      scrolled = false;
      measure();
    };
    // After a tab switch the page re-anchors to the top for ~300ms; scroll once it settles.
    const timers = [tabChanged ? 380 : 60, tabChanged ? 700 : 400].map((ms, k) =>
      window.setTimeout(k === 0 ? scrollAgain : measure, ms),
    );
    const iv = window.setInterval(measure, 250);
    window.addEventListener("resize", measure);
    return () => {
      timers.forEach(window.clearTimeout);
      window.clearInterval(iv);
      window.removeEventListener("resize", measure);
    };
  }, [open, i, onTab]);

  const close = useCallback(() => {
    setOpen(false);
    onTab?.("live");
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* storage unavailable */
    }
    if (user && !user.user_metadata?.tracking_tour_v2_seen) {
      void supabase.auth.updateUser({ data: { tracking_tour_v2_seen: true } });
    }
    scrollAppTo(0, "smooth");
  }, [user, onTab]);

  if (!open || typeof document === "undefined") return null;
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const next = () => (last ? close() : setI(i + 1));
  const pad = 8;
  // Card sits on whichever half of the screen the feature isn't in.
  const cardAtTop = spot ? spot.top + spot.height / 2 > vh / 2 : false;

  return createPortal(
    <div className="fixed inset-0 z-[9997]" role="dialog" aria-modal="true" aria-label="Tracking tour" onClick={next}>
      {spot ? (
        <div
          className="pointer-events-none fixed rounded-2xl ring-4 ring-cherry transition-all duration-300 ease-out"
          style={{
            top: spot.top - pad,
            left: spot.left - pad,
            width: spot.width + pad * 2,
            height: spot.height + pad * 2,
            boxShadow: "0 0 0 9999px color-mix(in oklab, var(--color-ink, #111) 65%, transparent)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-ink/65" />
      )}

      {tap ? (
        <div
          className="pointer-events-none fixed transition-all duration-300 ease-out"
          style={{ top: tap.top + tap.height / 2, left: tap.left + Math.min(tap.width / 2, 120) }}
        >
          <span className="absolute -left-5 -top-5 h-10 w-10 animate-ping rounded-full bg-cherry/50" />
          <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-cherry/70 ring-2 ring-primary-foreground" />
          <Pointer className="tour-tap absolute left-0 top-1 h-9 w-9 fill-primary-foreground text-ink drop-shadow-lg" />
        </div>
      ) : null}

      <div
        className={`fixed inset-x-0 flex justify-center px-4 ${cardAtTop ? "top-4" : "bottom-4"}`}
        style={cardAtTop ? { top: "calc(env(safe-area-inset-top) + 1rem)" } : { bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <div
          key={i}
          className="relative w-full max-w-md animate-fade-in overflow-hidden rounded-3xl bg-card shadow-2xl ring-1 ring-border"
        >
          <button
            type="button"
            aria-label="Close tour"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-muted text-ink-soft"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="max-h-[40dvh] overflow-y-auto px-5 pb-4 pt-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-cherry">
              Step {i + 1} of {STEPS.length}
            </p>
            <h2 className="mt-1 pr-8 font-display text-lg font-bold leading-tight text-ink">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
          </div>
          <div className="flex items-center gap-3 border-t border-border px-5 py-3">
            <div className="flex flex-1 items-center gap-1">
              {STEPS.map((_, n) => (
                <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-cherry" : "w-1.5 bg-border"}`} />
              ))}
            </div>
            {i > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setI(i - 1);
                }}
                className="text-sm font-semibold text-ink-soft"
              >
                Back
              </button>
            ) : null}
            <span className="rounded-full bg-cherry px-4 py-2 text-sm font-bold text-primary-foreground">
              {last ? "Let's go" : "Next"}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
