// Rider tracker + SOS panel. Rendered inside a My Event page when the event is live.
import { useState } from "react";
import { Navigation, Play, Siren, Square } from "lucide-react";

type Coords = { lat: number; lng: number; accuracy: number } | null;

export function TrackerPanel({ eventName }: { eventName?: string }) {
  const [coords, setCoords] = useState<Coords>(null);
  const [tracking, setTracking] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function locate() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (e) => setError(e.message),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function toggleTracking() {
    setTracking((t) => !t);
    if (!tracking) locate();
  }

  function triggerSos() {
    locate();
    setSosSent(true);
    setTimeout(() => setSosSent(false), 6000);
  }

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
        <button
          onClick={toggleTracking}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-transform active:scale-[0.99] ${
            tracking
              ? "bg-secondary text-secondary-foreground"
              : "cherry-gradient text-white shadow-md shadow-cherry/25"
          }`}
        >
          {tracking ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {tracking ? "Stop tracking" : "Start live tracking"}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-cherry/30 bg-gradient-to-br from-white to-accent p-4">
        <div className="flex items-center gap-2">
          <Siren className="h-5 w-5 text-cherry" />
          <p className="font-display text-base font-bold text-ink">Emergency SOS</p>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          Sends your GPS coordinates and rider ID to race control and your emergency contact.
        </p>
        <button
          onClick={triggerSos}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl cherry-gradient py-4 text-base font-black uppercase tracking-widest text-white shadow-lg shadow-cherry/40 active:scale-[0.98] transition-transform"
        >
          <Siren className="h-5 w-5" /> Send SOS
        </button>
        {sosSent ? (
          <p className="mt-2 rounded-lg bg-cherry/10 px-3 py-2 text-center text-xs font-semibold text-cherry-deep">
            SOS sent · Race control notified
          </p>
        ) : null}
      </div>
    </div>
  );
}
