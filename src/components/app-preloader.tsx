import { useEffect, useId, useRef, useState } from "react";

const ANIMATION_DURATION_MS = 1_600;
const SAFETY_TIMEOUT_MS = 8_000;

function wheelieAngle(progress: number) {
  if (progress >= 0.32 && progress < 0.44) {
    const phase = (progress - 0.32) / 0.12;
    return -22 * Math.sin(phase * (Math.PI / 2));
  }
  if (progress >= 0.44 && progress <= 0.66) {
    return -22 + Math.sin(progress * 40) * 1.2;
  }
  if (progress > 0.66 && progress <= 0.76) {
    const phase = (progress - 0.66) / 0.1;
    return -22 * (1 - Math.sin(phase * (Math.PI / 2)));
  }
  return 0;
}

export function AppPreloader() {
  const reactId = useId();
  const clipId = `ww-mountain-reveal-${reactId.replace(/:/g, "")}`;
  const redLineRef = useRef<SVGLineElement>(null);
  const bikeRef = useRef<SVGGElement>(null);
  const chassisRef = useRef<SVGGElement>(null);
  const clipRectRef = useRef<SVGRectElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let frame = 0;
    let startTime: number | undefined;
    let animationFinished = false;
    let pageFinished = document.readyState === "complete";
    let hasStartedLeaving = false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduceMotion ? 250 : ANIMATION_DURATION_MS;

    function beginLeaving() {
      if (hasStartedLeaving || (!animationFinished && !reduceMotion) || !pageFinished) return;
      hasStartedLeaving = true;
      setLeaving(true);
    }

    function render(progress: number) {
      const currentX = 20 + 560 * progress;
      redLineRef.current?.setAttribute("x2", String(currentX));
      clipRectRef.current?.setAttribute("width", String(currentX));
      bikeRef.current?.setAttribute("transform", `translate(${currentX}, 70)`);
      chassisRef.current?.setAttribute("transform", `rotate(${wheelieAngle(progress)})`);
    }

    function animate(timestamp: number) {
      startTime ??= timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      render(progress);
      if (progress < 1) {
        frame = window.requestAnimationFrame(animate);
        return;
      }
      animationFinished = true;
      beginLeaving();
    }

    function onPageLoad() {
      pageFinished = true;
      beginLeaving();
    }

    render(0);
    window.addEventListener("load", onPageLoad, { once: true });
    frame = window.requestAnimationFrame(animate);
    const safetyTimer = window.setTimeout(() => {
      pageFinished = true;
      animationFinished = true;
      beginLeaving();
    }, SAFETY_TIMEOUT_MS);

    return () => {
      window.removeEventListener("load", onPageLoad);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(safetyTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`ww-preloader${leaving ? " is-loaded" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Preparing your Rider Hub"
      onTransitionEnd={(event) => {
        if (leaving && event.propertyName === "opacity") setVisible(false);
      }}
    >
      <div className="ww-preloader-track-wrap">
        <div className="ww-preloader-meta" aria-hidden="true">
          <span className="ww-preloader-brand">OTTO1890</span>
          <span className="ww-preloader-dot" />
          <span className="ww-preloader-label">Preparing stage</span>
        </div>

        <div className="ww-preloader-canvas-box" aria-hidden="true">
          <svg viewBox="0 0 600 90" className="ww-preloader-svg" preserveAspectRatio="xMidYMid meet">
            <defs>
              <clipPath id={clipId}>
                <rect ref={clipRectRef} x="0" y="0" width="20" height="90" />
              </clipPath>
            </defs>

            <path className="ww-mountain-ghost" d="M 20,70 L 120,70 L 180,42 L 230,55 L 300,16 L 370,52 L 420,38 L 480,70 L 580,70" />
            <path className="ww-mountain-active" clipPath={`url(#${clipId})`} d="M 20,70 L 120,70 L 180,42 L 230,55 L 300,16 L 370,52 L 420,38 L 480,70 L 580,70" />
            <line className="ww-path-base" x1="20" y1="70" x2="580" y2="70" />
            <line ref={redLineRef} className="ww-path-fill" x1="20" y1="70" x2="20" y2="70" />

            <g ref={bikeRef} transform="translate(20, 70)">
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