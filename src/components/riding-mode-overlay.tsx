// Riding mode: while tracking, keeps the screen awake (browsers pause GPS when the
// phone locks) and covers the page with a dim lock so pocket taps don't press anything.
// Unlock and SOS both need a 2-second hold.
import { useEffect, useRef, useState } from "react";
import { Lock, Siren, Unlock } from "lucide-react";

const HOLD_MS = 2_000;

type WakeLockSentinelLike = { release: () => Promise<void> };

/** Keep the screen awake while `active`; re-acquires after the tab returns. */
export function useScreenWakeLock(active: boolean) {
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) {
      setSupported(false);
      return;
    }
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        const s = await nav.wakeLock!.request("screen");
        if (cancelled) void s.release();
        else sentinel = s;
      } catch {
        /* denied (low battery etc.) — retry on next visibility change */
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void sentinel?.release();
    };
  }, [active]);
  return supported;
}

function useHold(onDone: () => void) {
  const [pct, setPct] = useState(0);
  const timer = useRef<number | null>(null);
  const end = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    setPct(0);
  };
  const start = () => {
    if (timer.current !== null) return;
    const t0 = Date.now();
    timer.current = window.setInterval(() => {
      const p = Math.min(100, ((Date.now() - t0) / HOLD_MS) * 100);
      setPct(p);
      if (p >= 100) {
        end();
        onDone();
      }
    }, 50);
  };
  useEffect(() => end, []);
  return {
    pct,
    handlers: { onPointerDown: start, onPointerUp: end, onPointerLeave: end, onPointerCancel: end },
  };
}

export function RidingModeOverlay({
  elapsed,
  distance,
  gps,
  connection,
  onUnlock,
  onSos,
  sosSent,
  wakeSupported,
}: {
  elapsed: string;
  distance: string;
  gps: string;
  connection: string;
  onUnlock: () => void;
  onSos: () => void;
  sosSent: boolean;
  wakeSupported: boolean;
}) {
  const unlock = useHold(onUnlock);
  const sos = useHold(onSos);
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const i = window.setInterval(tick, 15_000);
    return () => window.clearInterval(i);
  }, []);

  return (
    <div
      role="dialog"
      aria-label="Riding mode — screen locked"
      className="fixed inset-0 z-[200] flex touch-none select-none flex-col items-center justify-between bg-ink/95 px-6 py-10 text-card"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="text-center">
        <p className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-card/60">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cherry" /> Tracking on · Screen locked
        </p>
        <p className="mt-3 text-6xl font-black tabular-nums text-card/90">{clock}</p>
      </div>

      <div className="grid w-full max-w-xs grid-cols-2 gap-3 text-center">
        <div className="rounded-2xl bg-card/5 p-4 ring-1 ring-card/10">
          <p className="text-2xl font-black text-card/90">{elapsed}</p>
          <p className="text-[10px] font-bold uppercase text-card/50">Riding</p>
        </div>
        <div className="rounded-2xl bg-card/5 p-4 ring-1 ring-card/10">
          <p className="text-2xl font-black text-card/90">{distance}</p>
          <p className="text-[10px] font-bold uppercase text-card/50">Distance</p>
        </div>
        <p className="col-span-2 text-xs text-card/60">
          {gps} · {connection}
        </p>
        <p className="col-span-2 text-xs font-semibold text-card/70">
          {wakeSupported
            ? "Keep this screen open — don't press the lock button. Your phone stays awake while you ride."
            : "Your phone may still go to sleep. Set Auto-Lock to Never in your phone settings while you ride."}
        </p>
      </div>

      <div className="w-full max-w-xs space-y-3">
        <button
          type="button"
          {...sos.handlers}
          className="relative w-full overflow-hidden rounded-2xl bg-cherry py-4 text-base font-black uppercase text-card shadow-lg"
        >
          <span className="absolute inset-y-0 left-0 bg-card/30" style={{ width: `${sos.pct}%` }} aria-hidden />
          <span className="relative flex items-center justify-center gap-2">
            <Siren className="h-5 w-5" />
            {sosSent ? "SOS sent · race control notified" : sos.pct > 0 ? "Keep holding…" : "Hold 2s for SOS"}
          </span>
        </button>
        <button
          type="button"
          {...unlock.handlers}
          className="relative w-full overflow-hidden rounded-2xl bg-card/10 py-4 text-sm font-bold text-card/80 ring-1 ring-card/20"
        >
          <span className="absolute inset-y-0 left-0 bg-card/20" style={{ width: `${unlock.pct}%` }} aria-hidden />
          <span className="relative flex items-center justify-center gap-2">
            {unlock.pct > 0 ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {unlock.pct > 0 ? "Keep holding…" : "Hold 2s to unlock"}
          </span>
        </button>
      </div>
    </div>
  );
}
