import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/ui-bits";
import { Siren, MapPin, Navigation, Users, Play, Square } from "lucide-react";

export const Route = createFileRoute("/tracker")({
  head: () => ({
    meta: [
      { title: "Ride Tracker — Red Cherry Events" },
      { name: "description", content: "Live rider tracking and emergency SOS for Red Cherry events." },
    ],
  }),
  component: Tracker,
});

type Coords = { lat: number; lng: number; accuracy: number } | null;

function Tracker() {
  const [coords, setCoords] = useState<Coords>(null);
  const [tracking, setTracking] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeRiders = [
    { id: "r1", name: "Sam Petersen", event: "Cherry Night Crit", km: 22.4 },
    { id: "r2", name: "Nomsa Dlamini", event: "Cherry Night Crit", km: 21.8 },
    { id: "r3", name: "Jake Bester", event: "Cherry Night Crit", km: 20.1 },
    { id: "r4", name: "Priya Naidoo", event: "Cherry Night Crit", km: 18.6 },
  ];

  function locate() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
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
    // In production: POST to /api/public/sos with coords + rider ID
    setTimeout(() => setSosSent(false), 6000);
  }

  return (
    <div>
      <PageHeader title="Ride Tracker" subtitle="Live position & safety" />

      {/* Map hero */}
      <div className="relative mx-5 mt-4 h-56 overflow-hidden rounded-2xl ring-1 ring-border">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 30%, oklch(0.94 0.03 25) 0, transparent 55%), radial-gradient(circle at 75% 70%, oklch(0.9 0.02 260) 0, transparent 60%), linear-gradient(180deg, oklch(0.97 0.005 260), oklch(0.92 0.01 260))",
          }}
        />
        {/* fake route path */}
        <svg viewBox="0 0 320 220" className="absolute inset-0 h-full w-full">
          <path
            d="M20 180 Q 90 60 160 120 T 300 40"
            stroke="oklch(0.585 0.235 25)"
            strokeWidth="3"
            fill="none"
          />
          {activeRiders.map((_, i) => {
            const x = 40 + i * 55;
            const y = 150 - i * 20;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="8" fill="oklch(0.585 0.235 25)" opacity="0.25" />
                <circle cx={x} cy={y} r="4" fill="oklch(0.585 0.235 25)" />
              </g>
            );
          })}
          {coords ? (
            <g>
              <circle cx="200" cy="90" r="12" fill="oklch(0.2 0.02 260)" opacity="0.15" />
              <circle cx="200" cy="90" r="6" fill="oklch(0.2 0.02 260)" />
              <circle cx="200" cy="90" r="6" fill="none" stroke="white" strokeWidth="2" />
            </g>
          ) : null}
        </svg>
        <div className="absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-semibold text-ink ring-1 ring-border backdrop-blur">
          <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${tracking ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
          {tracking ? "Tracking live" : "Tracking off"}
        </div>
      </div>

      {/* Position card */}
      <div className="mx-5 mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-cherry" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
            Your position
          </p>
        </div>
        {coords ? (
          <div className="mt-2 space-y-0.5 font-mono text-sm text-ink">
            <p>Lat  {coords.lat.toFixed(5)}°</p>
            <p>Lng  {coords.lng.toFixed(5)}°</p>
            <p className="text-xs text-muted-foreground">
              ± {Math.round(coords.accuracy)}m accuracy
            </p>
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

      {/* SOS */}
      <div className="mx-5 mt-4 overflow-hidden rounded-2xl border-2 border-cherry/30 bg-gradient-to-br from-white to-accent p-4">
        <div className="flex items-center gap-2">
          <Siren className="h-5 w-5 text-cherry" />
          <p className="font-display text-base font-bold text-ink">Emergency SOS</p>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          Hold to send your GPS coordinates and rider ID to race control and your emergency
          contact.
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

      {/* Active riders */}
      <div className="px-5 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
            Active riders
          </h2>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cherry">
            <Users className="h-3.5 w-3.5" /> {activeRiders.length} live
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {activeRiders.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-xl bg-card p-3 ring-1 ring-border"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-cherry-deep">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{r.event}</p>
                </div>
              </div>
              <span className="font-mono text-sm font-bold text-ink">{r.km.toFixed(1)}km</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="h-6" />
    </div>
  );
}
