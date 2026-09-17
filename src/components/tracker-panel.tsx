// Rider tracker + SOS panel. Rendered inside a My Event page when the event is live.
// Captures GPS every ~30s while tracking, buffers points locally (offline-safe),
// and uploads batches once a minute when there's signal.
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigation, Play, Siren, Smartphone, Square } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAdminStore } from "@/lib/store";
import { trackingWindow } from "@/lib/tracking-window";
import { useIsAdmin } from "@/lib/auth";
import {
  cancelMySos,
  fetchMySos,
  getMyResultStatus,
  sendTrackingSos,
  uploadTrackingPoints,
  SOS_REASONS,
  SOS_REASON_LABELS,
  type SosReason,
  type TrackingPointInput,
} from "@/lib/tracking.functions";

type Coords = { lat: number; lng: number; accuracy: number } | null;

// Live mode: record and send a position every 5 seconds. Chosen over 3s to cut
// database load ~40% at 300+ riders while staying well inside safety-tracking norms.
const FLUSH_INTERVAL_MS = 5_000;
const MIN_POINT_GAP_MS = 5_000;

// Press-and-hold duration before an SOS actually fires.
const SOS_HOLD_MS = 2_000;

/** True when the Rider Hub is running as an installed app (home-screen icon). */
function isInstalledApp() {
  if (typeof window === "undefined") return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}


function queueKey(eventId: string) {
  return `rce-track-queue-${eventId}`;
}

function activeKey(eventId: string) {
  return `rce-track-active-${eventId}`;
}

function loadActive(eventId: string) {
  try {
    return localStorage.getItem(activeKey(eventId)) === "1";
  } catch {
    return false;
  }
}

function saveActive(eventId: string, active: boolean) {
  try {
    if (active) localStorage.setItem(activeKey(eventId), "1");
    else localStorage.removeItem(activeKey(eventId));
  } catch {
    /* storage unavailable */
  }
}

function loadQueue(eventId: string): TrackingPointInput[] {
  try {
    const raw = localStorage.getItem(queueKey(eventId));
    return raw ? (JSON.parse(raw) as TrackingPointInput[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(eventId: string, points: TrackingPointInput[]) {
  try {
    if (points.length === 0) localStorage.removeItem(queueKey(eventId));
    else localStorage.setItem(queueKey(eventId), JSON.stringify(points.slice(-500)));
  } catch {
    /* storage full/unavailable — points stay in memory */
  }
}

async function batteryPct(): Promise<number | null> {
  try {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{ level: number }>;
    };
    if (!nav.getBattery) return null;
    const b = await nav.getBattery();
    return Math.round(b.level * 100);
  } catch {
    return null;
  }
}

export function TrackerPanel({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName?: string;
}) {
  const [coords, setCoords] = useState<Coords>(null);
  // Tracking survives navigation: the active flag lives in localStorage and the
  // GPS watch is re-attached whenever the panel mounts again.
  const [tracking, setTracking] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(0);
  const [lastUploadAt, setLastUploadAt] = useState<Date | null>(null);

  const event = useAdminStore((s) => s.events.find((e) => e.id === eventId));
  // Only this rider's own finish stops their tracking — not published results
  // for the field in general.
  const fetchMyResult = useServerFn(getMyResultStatus);
  const { data: myResult } = useQuery({
    queryKey: ["my-result-status", eventId],
    queryFn: () => fetchMyResult({ data: { eventId } }),
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });
  // Re-evaluate the window every 30s so the panel opens/closes on its own.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const resultsPublished = Boolean(myResult?.finished);
  const { isAdmin } = useIsAdmin();
  const computed = trackingWindow(event, { resultsPublished, now: new Date(clock) });
  // Admins can test tracking outside the window.
  const windowState = computed.open || !isAdmin
    ? computed
    : { ...computed, open: true, message: `${computed.message} (admin test override)` };

  const upload = useServerFn(uploadTrackingPoints);
  const sendSos = useServerFn(sendTrackingSos);

  const bufferRef = useRef<TrackingPointInput[]>([]);
  const lastPointAtRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);
  const flushingRef = useRef(false);
  const firstFlushRef = useRef(false);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    const pending = [...loadQueue(eventId), ...bufferRef.current];
    if (pending.length === 0) return;
    flushingRef.current = true;
    try {
      // Upload in chunks of 100; remove from the offline queue only on success.
      const remaining = [...pending];
      while (remaining.length > 0) {
        const batch = remaining.slice(0, 100);
        await upload({ data: { eventId, points: batch } });
        remaining.splice(0, batch.length);
      }
      bufferRef.current = [];
      saveQueue(eventId, []);
      setQueued(0);
      setLastUploadAt(new Date());
      setError(null);
    } catch {
      // No signal — park everything in the offline queue for the next flush.
      bufferRef.current = [];
      saveQueue(eventId, pending);
      setQueued(pending.length);
      setError("Couldn't reach race control — points saved on your phone and will retry.");
    } finally {
      flushingRef.current = false;
    }
  }, [eventId, upload]);

  const addPoint = useCallback(
    (pos: GeolocationPosition) => {
      const now = Date.now();
      if (now - lastPointAtRef.current < MIN_POINT_GAP_MS) return;
      lastPointAtRef.current = now;
      setCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
      void batteryPct().then((pct) => {
        bufferRef.current.push({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: Math.round(pos.coords.accuracy),
          batteryPct: pct,
          recordedAt: new Date(now).toISOString(),
        });
        setQueued(loadQueue(eventId).length + bufferRef.current.length);
        // Upload the very first point straight away so the rider appears on the
        // live map within seconds; after that the 15s interval batches uploads
        // instead of firing one request per second.
        if (!firstFlushRef.current) {
          firstFlushRef.current = true;
          void flush();
        }
      });

    },
    [eventId, flush],
  );


  const startTracking = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported on this device.");
      return;
    }
    setError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(addPoint, (e) => setError(e.message), {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
    });
    // Upload any points queued from a previous patchy-signal stretch.
    void flush();
  }, [addPoint, flush]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    firstFlushRef.current = false;
    void flush(); // push the remaining buffer out
  }, [flush]);

  // Resume an in-progress session after navigating back to this page.
  useEffect(() => {
    if (!loadActive(eventId) || watchIdRef.current !== null) return;
    setTracking(true);
    startTracking();
  }, [eventId, startTracking]);

  // Enforce the window: stop the GPS watch the moment tracking closes.
  useEffect(() => {
    if (!tracking || windowState.open) return;
    stopTracking();
    setTracking(false);
    saveActive(eventId, false);
  }, [tracking, windowState.open, stopTracking, eventId]);

  function toggleTracking() {
    if (!windowState.open && !tracking) return;
    if (tracking) stopTracking();
    else startTracking();
    setTracking((t) => !t);
    saveActive(eventId, !tracking);
  }

  // Periodic flush + flush when the app comes back to the foreground / online.
  useEffect(() => {
    if (!tracking) return;
    const interval = window.setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    const onOnline = () => void flush();
    const onVisible = () => {
      if (document.visibilityState === "visible") void flush();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tracking, flush]);

  // Stop the GPS watch when the component unmounts, and never lose buffered
  // points — park them in the offline queue so the next flush sends them.
  useEffect(
    () => () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (bufferRef.current.length > 0) {
        saveQueue(eventId, [...loadQueue(eventId), ...bufferRef.current]);
        bufferRef.current = [];
      }
    },
    [eventId],
  );


  // ---- SOS: reason + note, press-and-hold to send, cancel if it was a mistake.
  const [sosReason, setSosReason] = useState<SosReason>("medical");
  const [sosNote, setSosNote] = useState("");
  const [holdPct, setHoldPct] = useState(0);
  const holdTimer = useRef<number | null>(null);

  const cancelSos = useServerFn(cancelMySos);
  const fetchMine = useServerFn(fetchMySos);
  const mySosQ = useQuery({
    queryKey: ["my-sos", eventId],
    queryFn: () => fetchMine({ data: { eventId } }),
    refetchInterval: 20_000,
  });
  const openSos = mySosQ.data?.open ?? null;

  function triggerSos() {
    setError(null);
    const send = (pos: GeolocationPosition | null) => {
      void sendSos({
        data: {
          eventId,
          lat: pos?.coords.latitude ?? null,
          lng: pos?.coords.longitude ?? null,
          accuracyM: pos ? Math.round(pos.coords.accuracy) : null,
          reason: sosReason,
          message: sosNote.trim() ? sosNote.trim() : null,
        },
      })
        .then(() => {
          setSosSent(true);
          setSosNote("");
          void mySosQ.refetch();
          setTimeout(() => setSosSent(false), 8000);
        })
        .catch(() => setError("Could not send SOS — please call race control directly."));
    };
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(send, () => send(null), {
        enableHighAccuracy: true,
        timeout: 8000,
      });
    } else {
      send(null);
    }
  }

  // 2-second press-and-hold guards against an accidental tap on a safety button.
  function startHold() {
    if (holdTimer.current !== null) return;
    const started = Date.now();
    holdTimer.current = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - started) / SOS_HOLD_MS) * 100);
      setHoldPct(pct);
      if (pct >= 100) {
        endHold();
        triggerSos();
      }
    }, 50);
  }

  function endHold() {
    if (holdTimer.current !== null) window.clearInterval(holdTimer.current);
    holdTimer.current = null;
    setHoldPct(0);
  }

  useEffect(() => () => endHold(), []);

  // Background GPS only survives a locked screen in the installed app.
  const [needsInstall, setNeedsInstall] = useState(false);
  useEffect(() => setNeedsInstall(!isInstalledApp()), []);




  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-cherry" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            Your position{eventName ? ` · ${eventName}` : ""}
          </p>
        </div>
        {coords ? (
          <div className="mt-2 space-y-0.5 font-mono text-sm text-ink">
            <p>Lat  {coords.lat.toFixed(5)}°</p>
            <p>Lng  {coords.lng.toFixed(5)}°</p>
            <p className="text-xs text-muted-foreground">± {Math.round(coords.accuracy)}m accuracy</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {error ?? "Location not requested yet. Start tracking to share your position."}
          </p>
        )}
        {tracking ? (
          <p className="mt-2 text-xs text-ink-soft">
            {queued > 0
              ? `${queued} point${queued === 1 ? "" : "s"} saved on your phone — will upload when there's signal.`
              : lastUploadAt
                ? `Live · last upload ${lastUploadAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "Live · waiting for first GPS fix…"}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-ink-soft">{windowState.message}</p>
        {needsInstall ? (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-300">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-amber-700" />
              <p className="text-xs font-bold text-amber-900">
                Add the Rider Hub to your home screen first
              </p>
            </div>
            <p className="mt-1 text-xs text-amber-900/90">
              {isIos()
                ? "In Safari, tap the Share button and choose “Add to Home Screen”, then open the Rider Hub from that icon. Without it, iPhone stops your tracking a few seconds after the screen locks."
                : "Open your browser menu and choose “Install app” / “Add to Home screen”, then start tracking from that icon. Without it your phone may pause tracking when the screen locks."}
            </p>
          </div>
        ) : null}
        <button
          onClick={toggleTracking}
          disabled={!windowState.open && !tracking}
          className={`mt-3 disabled:cursor-not-allowed disabled:opacity-50 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-transform active:scale-[0.99] ${
            tracking
              ? "bg-secondary text-secondary-foreground"
              : "cherry-gradient text-white shadow-md shadow-cherry/25"
          }`}
        >
          {tracking ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {tracking
            ? "Stop tracking"
            : windowState.open
              ? "Start live tracking"
              : "Tracking unavailable"}
        </button>
        {tracking && needsInstall ? (
          <p className="mt-2 text-xs font-semibold text-amber-800">
            Keep this screen on — tracking pauses when your phone locks unless the Rider Hub is
            added to your home screen.
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-cherry/30 bg-gradient-to-br from-white to-accent p-4">
        <div className="flex items-center gap-2">
          <Siren className="h-5 w-5 text-cherry" />
          <p className="font-display text-base font-bold text-ink">Emergency SOS</p>
        </div>

        {openSos ? (
          <>
            <p className="mt-2 rounded-lg bg-cherry/10 px-3 py-2 text-xs font-semibold text-cherry-deep">
              SOS sent at {new Date(openSos.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {openSos.acknowledgedAt
                ? " · Race control has seen it and is on the way."
                : " · Waiting for race control to confirm…"}
            </p>
            <button
              onClick={() =>
                void cancelSos({ data: { eventId } }).then(() => void mySosQ.refetch())
              }
              className="mt-3 w-full rounded-xl bg-secondary py-3 text-sm font-bold text-secondary-foreground active:scale-[0.99]"
            >
              I'm okay now — cancel my SOS
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-xs text-ink-soft">
              Sends your GPS position, your name and this reason to race control.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SOS_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSosReason(r)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition-colors ${
                    sosReason === r
                      ? "bg-cherry text-white ring-cherry"
                      : "bg-card text-ink ring-border"
                  }`}
                >
                  {SOS_REASON_LABELS[r]}
                </button>
              ))}
            </div>
            <input
              value={sosNote}
              onChange={(e) => setSosNote(e.target.value.slice(0, 200))}
              placeholder="Add a short note (optional)"
              className="mt-2 w-full rounded-xl bg-card px-3 py-2.5 text-sm text-ink ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-cherry"
            />
            <button
              onPointerDown={startHold}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onPointerCancel={endHold}
              className="relative mt-3 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl cherry-gradient py-4 text-base font-black uppercase tracking-widest text-white shadow-lg shadow-cherry/40 active:scale-[0.98] transition-transform"
            >
              <span
                className="absolute inset-y-0 left-0 bg-white/30 transition-[width] duration-75"
                style={{ width: `${holdPct}%` }}
                aria-hidden
              />
              <Siren className="relative h-5 w-5" />
              <span className="relative">
                {holdPct > 0 ? "Keep holding…" : "Hold 2s to send SOS"}
              </span>
            </button>
            {sosSent ? (
              <p className="mt-2 rounded-lg bg-cherry/10 px-3 py-2 text-center text-xs font-semibold text-cherry-deep">
                SOS sent · Race control notified
              </p>
            ) : null}
          </>
        )}
      </div>

    </div>
  );
}
