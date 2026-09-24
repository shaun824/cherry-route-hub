// Rider tracker + SOS panel. Rendered inside a My Event page when the event is live.
// Captures GPS every ~30s while tracking, buffers points locally (offline-safe),
// and uploads batches once a minute when there's signal.
import { useCallback, useEffect, useRef, useState } from "react";
import { BatteryMedium, Clock3, Crosshair, LocateFixed, Play, Radio, Siren, Smartphone, Square, WifiOff } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAdminStore } from "@/lib/store";
import { trackingWindow } from "@/lib/tracking-window";
import { useIsAdmin } from "@/lib/auth";
import { useSession } from "@/lib/auth";
import { fetchEventInfo } from "@/lib/event-info";
import { haversineMeters } from "@/lib/geo";
import { resolveVenuePoint } from "@/lib/map-embed";
import { LiveTrackingMap } from "@/components/live-tracking-map";
import { Button } from "@/components/ui/button";
import type { ProgressResult } from "@/lib/course-progress";
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

type Coords = { lat: number; lng: number; accuracy: number; speedKph: number | null } | null;

// Live mode: record and send a position every 5 seconds. Chosen over 3s to cut
// database load ~40% at 300+ riders while staying well inside safety-tracking norms.
const FLUSH_INTERVAL_MS = 5_000;
const MIN_POINT_GAP_MS = 5_000;

// Press-and-hold duration before an SOS actually fires.
const SOS_HOLD_MS = 2_000;
const START_RADIUS_M = 1_000;

function formatElapsed(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

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

const ADMIN_SESSION_MS = 3 * 60 * 60_000;
const RIDER_SESSION_MS = 12 * 60 * 60_000;
const FINISH_RADIUS_M = 75;
function loadSessionStart(eventId: string): number | null {
  try {
    const v = Number(localStorage.getItem(`rc-track-start:${eventId}`));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}
function saveSessionStart(eventId: string, at: number | null) {
  try {
    if (at) localStorage.setItem(`rc-track-start:${eventId}`, String(at));
    else localStorage.removeItem(`rc-track-start:${eventId}`);
  } catch {
    /* ignore */
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
  const [battery, setBattery] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedNow, setElapsedNow] = useState(() => Date.now());
  const [distanceM, setDistanceM] = useState(0);
  const [checkingStart, setCheckingStart] = useState(false);
  const [startDistanceM, setStartDistanceM] = useState<number | null>(null);
  const [startCheckError, setStartCheckError] = useState<string | null>(null);
  const [courseProgress, setCourseProgress] = useState<ProgressResult | null>(null);
  const [sosHadLocation, setSosHadLocation] = useState<boolean | null>(null);
  const previousPointRef = useRef<{ lat: number; lng: number } | null>(null);

  const event = useAdminStore((s) => s.events.find((e) => e.id === eventId));
  const { user } = useSession();
  const eventInfoQ = useQuery({
    queryKey: ["event-info", eventId],
    queryFn: () => fetchEventInfo(eventId),
    staleTime: 300_000,
  });
  const eventInfo = eventInfoQ.data;
  const startPoint = resolveVenuePoint({
    mapUrl: eventInfo?.map_embed_url,
    lat: eventInfo?.venue_lat,
    lng: eventInfo?.venue_lng,
  });
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
  useEffect(() => {
    if (!tracking) return;
    const id = window.setInterval(() => setElapsedNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [tracking]);
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
        const res = await upload({ data: { eventId, points: batch, sessionStartedAt: loadSessionStart(eventId) } });
        if (res && "expired" in res && res.expired) {
          remaining.length = 0;
          break;
        }
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
        speedKph: pos.coords.speed == null ? null : Math.max(0, pos.coords.speed * 3.6),
      });
      void batteryPct().then((pct) => {
        setBattery(pct);
        bufferRef.current.push({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: Math.round(pos.coords.accuracy),
          batteryPct: pct,
          recordedAt: new Date(now).toISOString(),
        });
        setQueued(loadQueue(eventId).length + bufferRef.current.length);
        // Upload the very first point straight away so the rider appears on the
        // live map within seconds; after that the 5s interval batches uploads.
        if (!firstFlushRef.current) {
          firstFlushRef.current = true;
          void flush();
        }
      });
      const previous = previousPointRef.current;
      if (previous) {
        const step = haversineMeters(
          [previous.lng, previous.lat],
          [pos.coords.longitude, pos.coords.latitude],
        );
        if (step >= 3 && step < 500) setDistanceM((total) => total + step);
      }
      previousPointRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };

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
    previousPointRef.current = null;
    void flush(); // push the remaining buffer out
  }, [flush]);

  const checkStartArea = useCallback(() => {
    if (!startPoint) {
      setStartCheckError("The event start location is not available yet. Please ask race control.");
      return;
    }
    if (!("geolocation" in navigator)) {
      setStartCheckError("This device cannot check your location.");
      return;
    }
    setCheckingStart(true);
    setStartCheckError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const metres = haversineMeters(
          [startPoint.lng, startPoint.lat],
          [pos.coords.longitude, pos.coords.latitude],
        );
        setStartDistanceM(metres);
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speedKph: pos.coords.speed == null ? null : Math.max(0, pos.coords.speed * 3.6),
        });
        setCheckingStart(false);
      },
      (geoError) => {
        setStartCheckError(
          geoError.code === geoError.PERMISSION_DENIED
            ? "Allow location access to confirm you are at the race village."
            : "We could not confirm your location. Move into the open and try again.",
        );
        setCheckingStart(false);
      },
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 15_000 },
    );
  }, [startPoint]);

  // Resume an in-progress session after navigating back to this page.
  useEffect(() => {
    if (!loadActive(eventId) || watchIdRef.current !== null) return;
    const saved = loadSessionStart(eventId);
    if (saved) setStartedAt(saved);
    setTracking(true);
    startTracking();
  }, [eventId, startTracking]);

  // Hard session limit so a forgotten phone (or an admin test) never tracks for ever.
  const sessionLimitMs = isAdmin || !computed.open ? ADMIN_SESSION_MS : RIDER_SESSION_MS;
  const sessionLeftMs = tracking && startedAt ? startedAt + sessionLimitMs - elapsedNow : null;
  const [autoStopNote, setAutoStopNote] = useState<string | null>(null);
  const endSession = useCallback(
    (note: string) => {
      stopTracking();
      setTracking(false);
      saveActive(eventId, false);
      saveSessionStart(eventId, null);
      setAutoStopNote(note);
    },
    [stopTracking, eventId],
  );
  useEffect(() => {
    if (sessionLeftMs !== null && sessionLeftMs <= 0) {
      endSession(
        isAdmin
          ? "Test tracking stopped automatically after 3 hours."
          : "Tracking stopped automatically after 12 hours. Start again if you are still riding.",
      );
    }
  }, [sessionLeftMs, endSession, isAdmin]);
  const extendSession = () => {
    const next = Date.now() - sessionLimitMs + 60 * 60_000; // one more hour
    const s = Math.max(startedAt ?? 0, next);
    setStartedAt(s);
    saveSessionStart(eventId, s);
  };

  // Stop at the finish line: most of the route covered and at its end.
  useEffect(() => {
    if (!tracking || !courseProgress) return;
    const remaining = courseProgress.totalM - courseProgress.alongM;
    if (courseProgress.pct >= 90 && remaining <= FINISH_RADIUS_M && courseProgress.offCourseM <= 150) {
      endSession("You've finished — tracking stopped. Well ridden!");
    }
  }, [tracking, courseProgress, endSession]);

  // Enforce the window: stop the GPS watch the moment tracking closes.
  useEffect(() => {
    if (!tracking || windowState.open) return;
    stopTracking();
    setTracking(false);
    saveActive(eventId, false);
  }, [tracking, windowState.open, stopTracking, eventId]);

  function toggleTracking() {
    if ((!windowState.open || startDistanceM === null || startDistanceM > START_RADIUS_M) && !tracking) return;
    if (tracking) stopTracking();
    else {
      const now = Date.now();
      setStartedAt(now);
      saveSessionStart(eventId, now);
      setAutoStopNote(null);
      setElapsedNow(now);
      setDistanceM(0);
      startTracking();
    }
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
      setSosHadLocation(Boolean(pos));
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

  const insideStartArea = startDistanceM !== null && startDistanceM <= START_RADIUS_M;
  const canStart = windowState.open && insideStartArea;
  const gpsQuality = !coords
    ? "Finding GPS"
    : coords.accuracy <= 20
      ? "Good GPS"
      : coords.accuracy <= 50
        ? "Fair GPS"
        : "Weak GPS";
  const connectionState = typeof navigator !== "undefined" && !navigator.onLine
    ? "Offline · safely queued"
    : queued > 0
      ? "Uploading saved points"
      : lastUploadAt
        ? "Sharing normally"
        : "Waiting for first upload";
  return (
    <div className="space-y-3">
      {autoStopNote && !tracking ? (
        <div className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-ink ring-1 ring-border">{autoStopNote}</div>
      ) : null}
      {sessionLeftMs !== null && sessionLeftMs < 10 * 60_000 ? (
        <div className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-ink ring-1 ring-border">
          <span className="flex-1">Tracking stops in {Math.max(1, Math.ceil(sessionLeftMs / 60_000))} min.</span>
          {!isAdmin ? (
            <button type="button" onClick={extendSession} className="rounded-full bg-cherry px-3 py-1 font-bold text-primary-foreground">
              Keep tracking
            </button>
          ) : null}
        </div>
      ) : null}
      {tracking ? (
        <div className="relative overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          <LiveTrackingMap
            eventId={eventId}
            focusUserId={user?.id ?? null}
            riderMode
            onFocusedProgress={setCourseProgress}
            currentPosition={coords ? { lat: coords.lat, lng: coords.lng } : null}
          />
          <div className="absolute inset-x-3 top-3 z-[500] grid grid-cols-2 gap-1.5 rounded-xl bg-card/95 p-2.5 shadow-lg ring-1 ring-border backdrop-blur sm:grid-cols-4">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink"><Crosshair className="h-3.5 w-3.5 text-cherry" />{gpsQuality} · {coords ? `±${Math.round(coords.accuracy)}m` : "…"}</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink"><Radio className="h-3.5 w-3.5 text-cherry" />{connectionState}</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink"><BatteryMedium className="h-3.5 w-3.5 text-cherry" />{battery === null ? "Battery —" : `${battery}%`}</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-ink"><Clock3 className="h-3.5 w-3.5 text-cherry" />{formatElapsed(elapsedNow - (startedAt ?? elapsedNow))}</span>
          </div>
          <div className="absolute inset-x-3 bottom-3 z-[500] rounded-xl bg-card/95 p-3 shadow-lg ring-1 ring-border backdrop-blur">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="text-base font-black text-ink">{courseProgress ? `${(courseProgress.alongM / 1000).toFixed(1)} km` : `${(distanceM / 1000).toFixed(1)} km`}</p><p className="text-[10px] font-bold uppercase text-ink-soft">Distance</p></div>
              <div><p className="text-base font-black text-ink">{courseProgress ? `${Math.round(courseProgress.pct)}%` : "—"}</p><p className="text-[10px] font-bold uppercase text-ink-soft">Complete</p></div>
              <div><p className="text-base font-black text-ink">{coords?.speedKph === null || coords?.speedKph === undefined ? "—" : coords.speedKph.toFixed(1)}</p><p className="text-[10px] font-bold uppercase text-ink-soft">km/h</p></div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="flex items-center gap-2">
          <LocateFixed className="h-4 w-4 text-cherry" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            {tracking ? "Live tracking" : "Race-day readiness"}{eventName ? ` · ${eventName}` : ""}
          </p>
        </div>
        {!tracking ? (
          <div className="mt-3 space-y-2 text-sm">
            <p className="flex items-center justify-between gap-3"><span className="text-ink-soft">Tracking time</span><strong className="text-right text-ink">{windowState.message}</strong></p>
            <p className="flex items-center justify-between gap-3"><span className="text-ink-soft">Race village</span><strong className={insideStartArea ? "text-emerald-700" : "text-ink"}>{startDistanceM === null ? "Not checked" : insideStartArea ? `Ready · ${Math.round(startDistanceM)}m from start` : `${(startDistanceM / 1000).toFixed(1)} km away`}</strong></p>
            <p className="flex items-center justify-between gap-3"><span className="text-ink-soft">Battery</span><strong className="text-ink">{battery === null ? "Check on start" : `${battery}%`}</strong></p>
            <Button type="button" variant="outline" className="w-full" onClick={checkStartArea} disabled={checkingStart || eventInfoQ.isLoading}>
              <LocateFixed className="h-4 w-4" />{checkingStart ? "Checking location…" : startDistanceM === null ? "Check my location" : "Retry location"}
            </Button>
            {startCheckError ? <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{startCheckError}</p> : null}
            {startDistanceM !== null && !insideStartArea ? <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">Tracking unlocks inside 1 km of the event start. Move closer, then retry.</p> : null}
          </div>
        ) : (
          <p className="mt-2 text-xs text-ink-soft">Positions record every 5 seconds. {queued > 0 ? `${queued} waiting safely on this phone.` : lastUploadAt ? `Last shared at ${lastUploadAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}.` : "Waiting for the first GPS fix."}</p>
        )}
        {error ? <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"><WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p> : null}
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
        <Button
          onClick={toggleTracking}
          disabled={!canStart && !tracking}
          variant={tracking ? "secondary" : "default"}
          className="mt-3 w-full"
        >
          {tracking ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {tracking
            ? "Stop tracking"
            : windowState.open
              ? insideStartArea ? "Start live tracking" : "Check location to start"
              : "Tracking unavailable"}
        </Button>
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
            <Button
              variant="secondary"
              onClick={() =>
                void cancelSos({ data: { eventId } }).then(() => void mySosQ.refetch())
              }
              className="mt-3 w-full"
            >
              I'm okay now — cancel my SOS
            </Button>
          </>
        ) : (
          <>
            <p className="mt-1 text-xs text-ink-soft">
              Sends your GPS position, your name and this reason to race control.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SOS_REASONS.map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant={sosReason === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSosReason(r)}
                  className="rounded-full"
                >
                  {SOS_REASON_LABELS[r]}
                </Button>
              ))}
            </div>
            <input
              value={sosNote}
              onChange={(e) => setSosNote(e.target.value.slice(0, 200))}
              placeholder="Add a short note (optional)"
              className="mt-2 w-full rounded-xl bg-card px-3 py-2.5 text-sm text-ink ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-cherry"
            />
            <Button
              onPointerDown={startHold}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onPointerCancel={endHold}
              className="relative mt-3 w-full overflow-hidden py-4 text-base font-black uppercase shadow-lg shadow-cherry/40"
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
            </Button>
            {sosSent ? (
              <p className="mt-2 rounded-lg bg-cherry/10 px-3 py-2 text-center text-xs font-semibold text-cherry-deep">
                SOS sent {sosHadLocation ? "with your location" : "without a GPS fix"} · Race control notified
              </p>
            ) : null}
          </>
        )}
      </div>

    </div>
  );
}
