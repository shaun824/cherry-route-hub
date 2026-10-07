// Rider Hub loading screen: a bike rides a freshly generated set of ramps on
// every lap, and each lap adds another jump. Shown briefly on app start and on
// slow page changes, with a minimum on-screen time so it never flickers.
import { useEffect, useRef, useState } from "react";

const SHOW_DELAY_MS = 250; // fast page changes never show the loader
const MIN_VISIBLE_MS = 900; // once shown, stay long enough to look intentional
const FIRST_LOAD_MS = 1_500; // one full lap on app start
const SAFETY_TIMEOUT_MS = 6_000;
const FADE_MS = 320;
const LAP_MS = 1_900;
const GROUND = 70;
const START_X = 20;
const END_X = 580;

type Jump = { x0: number; kick: number; h: number; gap: number; land: number };
type Course = { jumps: Jump[]; d: string };

function makeCourse(count: number): Course {
  const usable = END_X - START_X - 60;
  const slot = usable / count;
  const jumps: Jump[] = [];
  for (let i = 0; i < count; i++) {
    const h = 10 + Math.random() * (count > 4 ? 16 : 22);
    const kick = Math.min(slot * 0.28, 14 + h * 0.9);
    const gap = Math.min(slot * 0.32, 14 + Math.random() * 26);
    const land = Math.min(slot * 0.3, kick * 1.3);
    const total = kick + gap + land;
    const x0 = START_X + 40 + i * slot + Math.max(0, (slot - total) * (0.2 + Math.random() * 0.5));
    jumps.push({ x0, kick, h, gap, land });
  }
  let d = `M ${START_X},${GROUND}`;
  for (const j of jumps) {
    const lip = j.x0 + j.kick;
    const ls = lip + j.gap;
    d += ` L ${j.x0},${GROUND} Q ${j.x0 + j.kick * 0.7},${GROUND} ${lip},${GROUND - j.h} L ${lip},${GROUND}`;
    d += ` M ${ls},${GROUND} L ${ls},${GROUND - j.h} L ${ls + j.land},${GROUND}`;
  }
  d += ` L ${END_X},${GROUND}`;
  return { jumps, d };
}

/** Bike height and tilt at x along the course. */
function sample(c: Course, x: number): { y: number; angle: number } {
  for (const j of c.jumps) {
    const lip = j.x0 + j.kick;
    const ls = lip + j.gap;
    const le = ls + j.land;
    if (x < j.x0 || x > le) continue;
    if (x <= lip) {
      // Curved kicker: steepens towards the lip.
      const t = (x - j.x0) / j.kick;
      const y = GROUND - j.h * t * t;
      return { y, angle: (-Math.atan2(2 * j.h * t, j.kick) * 180) / Math.PI };
    }
    if (x < ls) {
      // Airborne: parabola from lip to landing deck with some hang time.
      const t = (x - lip) / j.gap;
      const apex = 8 + j.gap * 0.35;
      const y = GROUND - j.h - 4 * apex * t * (1 - t);
      const slope = (-4 * apex * (1 - 2 * t)) / j.gap;
      return { y, angle: (Math.atan(slope) * 180) / Math.PI * 0.8 };
    }
    const t = (x - ls) / j.land;
    return { y: GROUND - j.h * (1 - t), angle: (Math.atan2(j.h, j.land) * 180) / Math.PI };
  }
  return { y: GROUND, angle: 0 };
}

export function AppPreloader({ routeLoading }: { routeLoading: boolean }) {
  const pathRef = useRef<SVGPathElement>(null);
  const fillRef = useRef<SVGLineElement>(null);
  const bikeRef = useRef<SVGGElement>(null);
  const chassisRef = useRef<SVGGElement>(null);
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const shownAt = useRef(0);
  const minUntil = useRef(0);

  const show = (minMs: number) => {
    shownAt.current = performance.now();
    minUntil.current = shownAt.current + minMs;
    setLeaving(false);
    setVisible(true);
  };

  // App start: one smooth lap while the first screen settles.
  useEffect(() => {
    show(FIRST_LOAD_MS);
  }, []);

  // Slow page changes.
  useEffect(() => {
    if (!routeLoading) return;
    const t = window.setTimeout(() => {
      if (!visible) show(MIN_VISIBLE_MS);
    }, SHOW_DELAY_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeLoading]);

  // Hide once loading ends and the minimum time has passed (or on safety timeout).
  useEffect(() => {
    if (!visible || leaving) return;
    const now = performance.now();
    const wait = routeLoading
      ? Math.max(0, shownAt.current + SAFETY_TIMEOUT_MS - now)
      : Math.max(0, minUntil.current - now);
    const t = window.setTimeout(() => setLeaving(true), wait);
    return () => window.clearTimeout(t);
  }, [visible, leaving, routeLoading]);

  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => {
      setVisible(false);
      setLeaving(false);
    }, FADE_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);

  // Animation loop — keeps running through the fade so nothing freezes mid-air.
  useEffect(() => {
    if (!visible) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lap = 0;
    let course = makeCourse(2);
    pathRef.current?.setAttribute("d", course.d);
    let start: number | undefined;
    let frame = 0;
    let smoothAngle = 0;

    const render = (p: number) => {
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const x = START_X + (END_X - START_X) * (0.15 * p + 0.85 * eased);
      const { y, angle } = sample(course, x);
      smoothAngle += (angle - smoothAngle) * 0.35;
      fillRef.current?.setAttribute("x2", String(x));
      bikeRef.current?.setAttribute("transform", `translate(${x.toFixed(2)}, ${y.toFixed(2)})`);
      chassisRef.current?.setAttribute("transform", `rotate(${smoothAngle.toFixed(2)})`);
    };

    const tick = (ts: number) => {
      start ??= ts;
      const elapsed = ts - start;
      const thisLap = Math.floor(elapsed / LAP_MS);
      if (thisLap !== lap) {
        lap = thisLap;
        // New ramps every lap, one more jump each time (capped so it stays readable).
        course = makeCourse(Math.min(2 + lap, 7));
        pathRef.current?.setAttribute("d", course.d);
        smoothAngle = 0;
      }
      render((elapsed % LAP_MS) / LAP_MS);
      frame = requestAnimationFrame(tick);
    };

    if (reduce) render(0.5);
    else frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`ww-preloader${leaving ? " is-loaded" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Preparing your Rider Hub"
    >
      <div className="ww-preloader-track-wrap">
        <div className="ww-preloader-meta" aria-hidden="true">
          <span className="ww-preloader-brand">Rider Hub</span>
          <span className="ww-preloader-dot" />
          <span className="ww-preloader-label">Warming up</span>
        </div>

        <div className="ww-preloader-canvas-box" aria-hidden="true">
          <svg viewBox="0 0 600 90" className="ww-preloader-svg" preserveAspectRatio="xMidYMid meet">
            <line className="ww-path-base" x1={START_X} y1={GROUND} x2={END_X} y2={GROUND} />
            <line ref={fillRef} className="ww-path-fill" x1={START_X} y1={GROUND} x2={START_X} y2={GROUND} />
            <path ref={pathRef} className="ww-ramps" d="" />

            <g ref={bikeRef} transform={`translate(${START_X}, ${GROUND})`}>
              <g className="ww-loader-wind-lines">
                <line className="ww-loader-wind ww-loader-wind-1" x1="-16" y1="-26" x2="-36" y2="-26" />
                <line className="ww-loader-wind ww-loader-wind-2" x1="-20" y1="-18" x2="-44" y2="-18" />
                <line className="ww-loader-wind ww-loader-wind-3" x1="-14" y1="-10" x2="-30" y2="-10" />
              </g>
              <g ref={chassisRef} className="ww-bike-chassis">
                <g transform="translate(-16, -35) scale(0.062)">
                  <path fill="currentColor" d="M400 96a48 48 0 1 0 -96 0 48 48 0 1 0 96 0zm-8 128a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm-144-64a32 32 0 1 0 0-64 32 32 0 1 0 0 64zm173.3 84.8l-40.7-65.1c-6-9.6-16.5-15.7-27.9-16.3l-59.5-3.3c-14.8-.8-28.5 7.4-34.9 20.7l-26.7 55.6c-5.4 11.2-1.2 24.7 9.7 30.8s24.4 2.2 30.8-8.6l17.7-30 29.5 1.6-43.2 86.4c-4.4 8.8-3.4 19.3 2.6 27.2l64 80c8.2 10.2 23.3 11.8 33.5 3.6s11.8-23.3 3.6-33.5l-52.6-65.7 31.8-63.5 28.5 45.6c6.2 10 17.1 16.1 28.8 16.1h64c13.3 0 24-10.7 24-24s-10.7-24-24-24h-49.9zM128 320a96 96 0 1 0 0 192 96 96 0 1 0 0-192zm0 144a48 48 0 1 1 0-96 48 48 0 1 1 0 96zm384-144a96 96 0 1 0 0 192 96 96 0 1 0 0-192zm0 144a48 48 0 1 1 0-96 48 48 0 1 1 0 96z" />
                </g>
              </g>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
