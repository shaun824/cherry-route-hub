import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Mountain, RefreshCw } from "lucide-react";
import {
  getStravaPanel,
  startStravaConnect,
  syncMyStrava,
  disconnectStrava,
  type StravaPanelPayload,
} from "@/lib/strava.functions";

function fmt(s: number | null) {
  if (s == null) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

export function StravaSegmentsPanel({ eventId, entrantId }: { eventId: string; entrantId: string }) {
  const qc = useQueryClient();
  const fetchPanel = useServerFn(getStravaPanel);
  const connect = useServerFn(startStravaConnect);
  const sync = useServerFn(syncMyStrava);
  const disconnect = useServerFn(disconnectStrava);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const key = ["strava-panel", eventId, entrantId];
  const q = useQuery<StravaPanelPayload>({
    queryKey: key,
    queryFn: () => fetchPanel({ data: { eventId, entrantId } }),
    staleTime: 60_000,
  });
  const d = q.data;

  const runSync = async () => {
    setBusy(true);
    setNote(null);
    const r = await sync({ data: { eventId } });
    setBusy(false);
    setNote(r.ok ? `Found ${r.activities} ride${r.activities === 1 ? "" : "s"} on the event days.` : "Couldn’t reach Strava just now — try again in a minute.");
    qc.invalidateQueries({ queryKey: key });
  };

  // Auto-sync once after returning from Strava.
  const did = useRef(false);
  useEffect(() => {
    if (did.current || !d?.isOwn || !d.connected) return;
    if (new URLSearchParams(window.location.search).get("strava") === "connected") {
      did.current = true;
      void runSync();
    }
  }, [d?.isOwn, d?.connected]);

  if (!d || !d.configured) return null;

  const lost = d.segments
    .filter((s) => s.my_s != null && s.best_s != null && s.my_s > s.best_s)
    .sort((a, b) => b.my_s! - b.best_s! - (a.my_s! - a.best_s!))
    .slice(0, 3);

  return (
    <section>
      <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
        Strava segments
      </h2>

      {d.isOwn ? (
        <div className="mt-3 rounded-2xl bg-card p-4 ring-1 ring-border">
          {d.connected ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex-1 text-sm text-ink">Strava connected. Your segment times on the event days show below.</p>
              <button type="button" disabled={busy} onClick={runSync} className="inline-flex items-center gap-1.5 rounded-full bg-cherry px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
                <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> {busy ? "Checking…" : "Update from Strava"}
              </button>
              <button type="button" onClick={async () => { await disconnect(); qc.invalidateQueries({ queryKey: key }); }} className="text-xs font-semibold text-ink-soft underline">
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-sm text-ink">Connect Strava to see your time on each section of the course, and where you gained or lost time.</p>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await connect({ data: { returnTo: window.location.pathname } });
                  window.location.href = r.url;
                }}
                className="rounded-full bg-[#FC4C02] px-4 py-2 text-xs font-bold text-primary-foreground"
              >
                Connect with Strava
              </button>
            </div>
          )}
          {note ? <p className="mt-2 text-xs text-ink-soft">{note}</p> : null}
        </div>
      ) : null}

      {lost.length > 0 ? (
        <div className="mt-3 rounded-2xl bg-accent p-3 text-sm text-ink">
          <p className="font-semibold">Where you lost the most time</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {lost.map((s) => (
              <li key={s.segment_id}>Lost {fmt(s.my_s! - s.best_s!)} on {s.name}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {d.segments.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-border p-4 text-center text-sm text-ink-soft">
          Segments appear here once riders who’ve connected Strava upload their rides from the event.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {d.segments.map((s) => (
            <li key={s.segment_id} className="rounded-2xl bg-card p-3 ring-1 ring-border">
              <div className="flex items-start gap-2">
                <Mountain className="mt-0.5 h-4 w-4 shrink-0 text-cherry" />
                <p className="flex-1 text-sm font-semibold text-ink">{s.name}</p>
                <a href={`https://www.strava.com/segments/${s.segment_id}`} target="_blank" rel="noreferrer" aria-label="Open in Strava" className="text-ink-soft">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {s.distance_m != null ? `${(s.distance_m / 1000).toFixed(1)} km` : ""}
                {s.average_grade != null ? ` · ${s.average_grade.toFixed(1)}% avg` : ""} · {s.riders} rider{s.riders === 1 ? "" : "s"}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px] text-ink-soft">
                <div><p>{d.isOwn ? "You" : "Rider"}</p><p className="font-mono text-sm font-bold text-ink">{fmt(s.my_s)}</p></div>
                <div><p>Fastest</p><p className="font-mono text-sm font-bold text-ink">{fmt(s.best_s)}</p></div>
                <div><p>Average</p><p className="font-mono text-sm font-bold text-ink">{fmt(s.avg_s)}</p></div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[11px] text-ink-soft">Fastest and average compare riders in the same category who connected Strava.</p>
    </section>
  );
}
