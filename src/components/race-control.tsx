// Race control: live rider map + SOS alert list for a chosen event.
// Shared by the admin console and the crew portal (crew + admin only).
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  BellOff,
  List,
  Map as MapIcon,
  Radar,
  RefreshCw,
  Siren,
} from "lucide-react";
import { LiveTrackingMap } from "@/components/live-tracking-map";
import {
  acknowledgeSosAlert,
  escalateSosAlert,
  fetchLiveTracking,
  fetchSosAlerts,
  fetchTrackingEvents,
  resolveSosAlert,
  SOS_REASON_LABELS,
  type LiveRiderPosition,
  type SosAlert,
  type SosReason,
} from "@/lib/tracking.functions";
import { readCrewEventId, writeCrewEventId } from "@/lib/crew-event";
import { primeAlarmAudio, useSosAlarm } from "@/lib/sos-alarm";

// An alert nobody has acknowledged in this long escalates to a louder alarm
// and a second push to the rest of the crew.
const ESCALATE_AFTER_MS = 90_000;
const LOST_SIGNAL_MS = 10 * 60_000;
const STALE_MS = 5 * 60_000;

function reasonLabel(reason: string | null) {
  if (!reason) return "SOS";
  return SOS_REASON_LABELS[reason as SosReason] ?? reason;
}

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export function RaceControlPanel({
  title = "Live tracking",
  shareCrewEvent = false,
}: {
  title?: string;
  /** Crew portal: open on (and remember) the event picked on the crew dashboard. */
  shareCrewEvent?: boolean;
}) {
  const queryClient = useQueryClient();
  const [eventId, setEventId] = useState<string | null>(() =>
    shareCrewEvent ? readCrewEventId() : null,
  );
  const [view, setView] = useState<"map" | "list">("map");
  const [muted, setMuted] = useState(false);
  const [focusRider, setFocusRider] = useState<string | null>(null);
  const [offCourse, setOffCourse] = useState<Record<string, number>>({});

  const resolve = useServerFn(resolveSosAlert);
  const acknowledge = useServerFn(acknowledgeSosAlert);
  const escalate = useServerFn(escalateSosAlert);

  const eventsQ = useQuery({
    queryKey: ["tracking-events"],
    queryFn: () => fetchTrackingEvents(),
  });
  const events = eventsQ.data ?? [];
  const selected =
    (eventId && events.some((e) => e.id === eventId) ? eventId : null) ?? events[0]?.id ?? null;

  const sosQ = useQuery({
    queryKey: ["tracking-sos", selected],
    queryFn: () => fetchSosAlerts({ data: { eventId: selected } }),
    enabled: Boolean(selected),
    refetchInterval: 5_000,
  });
  const alerts = sosQ.data?.alerts ?? [];
  const unacknowledged = alerts.filter((a) => a.status === "active");
  const open = alerts.filter((a) => a.status === "active" || a.status === "acknowledged");

  const ridersQ = useQuery({
    queryKey: ["live-tracking-list", selected],
    queryFn: () => fetchLiveTracking({ data: { eventId: selected! } }),
    enabled: Boolean(selected),
    refetchInterval: 10_000,
  });
  const riders = useMemo(() => ridersQ.data?.riders ?? [], [ridersQ.data]);

  // Unacknowledged alerts sound the alarm; escalation makes it insistent.
  const escalated = unacknowledged.some(
    (a) => Date.now() - new Date(a.createdAt).getTime() > ESCALATE_AFTER_MS,
  );
  useSosAlarm(unacknowledged.length > 0 && !muted, escalated, "SOS — race control");

  // Unmute again as soon as a brand-new alert arrives.
  const lastCount = useRef(0);
  useEffect(() => {
    if (unacknowledged.length > lastCount.current) {
      setMuted(false);
      primeAlarmAudio();
    }
    lastCount.current = unacknowledged.length;
  }, [unacknowledged.length]);

  // Escalate server-side once per alert (the function is idempotent).
  const escalatedIds = useRef(new Set<string>());
  useEffect(() => {
    for (const a of unacknowledged) {
      if (escalatedIds.current.has(a.id) || a.escalatedAt) continue;
      if (Date.now() - new Date(a.createdAt).getTime() < ESCALATE_AFTER_MS) continue;
      escalatedIds.current.add(a.id);
      void escalate({ data: { id: a.id } });
    }
  }, [unacknowledged, escalate]);

  function refreshAll() {
    void queryClient.invalidateQueries({ queryKey: ["tracking-sos"] });
    void queryClient.invalidateQueries({ queryKey: ["live-tracking"] });
    void queryClient.invalidateQueries({ queryKey: ["live-tracking-list"] });
  }

  const stopped = riders
    .filter((r) => r.stoppedForMs != null && !r.finished && !r.sos)
    .sort((a, b) => (b.stoppedForMs ?? 0) - (a.stoppedForMs ?? 0));
  const offCourseRiders = riders.filter(
    (r) => offCourse[r.userId] != null && !r.finished && !r.sos,
  );

  return (
    <div className="space-y-4" onPointerDown={() => primeAlarmAudio()}>
      {/* Full-width takeover: an unacknowledged SOS must interrupt, not queue. */}
      {unacknowledged.length > 0 ? (
        <div
          className={`sticky top-0 z-50 rounded-2xl border-2 p-4 shadow-xl ${
            escalated
              ? "animate-pulse border-cherry bg-cherry text-white"
              : "border-cherry bg-cherry/10"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Siren className={`h-6 w-6 ${escalated ? "text-white" : "text-cherry"}`} />
              <p className="font-display text-lg font-black">
                {unacknowledged.length} SOS need{unacknowledged.length === 1 ? "s" : ""} a response
                {escalated ? " · ESCALATED" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                escalated ? "bg-white text-cherry" : "bg-card text-ink ring-1 ring-border"
              }`}
            >
              <BellOff className="h-3.5 w-3.5" /> {muted ? "Unmute" : "Mute alarm"}
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {unacknowledged.map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                onFocus={() => {
                  setFocusRider(a.userId);
                  setView("map");
                }}
                onAcknowledge={() =>
                  void acknowledge({ data: { id: a.id } }).then(() => void sosQ.refetch())
                }
                onResolve={() =>
                  void resolve({ data: { id: a.id } }).then(() => void sosQ.refetch())
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-cherry" />
          <h1 className="font-display text-lg font-bold text-ink">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView((v) => (v === "map" ? "list" : "map"))}
            className="flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-xs font-semibold text-ink ring-1 ring-border hover:bg-accent"
          >
            {view === "map" ? (
              <>
                <List className="h-3.5 w-3.5" /> List
              </>
            ) : (
              <>
                <MapIcon className="h-3.5 w-3.5" /> Map
              </>
            )}
          </button>
          <button
            type="button"
            onClick={refreshAll}
            className="flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-xs font-semibold text-ink ring-1 ring-border hover:bg-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      <select
        value={selected ?? ""}
        onChange={(e) => {
          const next = e.target.value || null;
          setEventId(next);
          if (shareCrewEvent && next) writeCrewEventId(next);
        }}
        className="w-full rounded-xl bg-card px-3 py-2.5 text-sm text-ink ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-cherry"
      >
        {events.length === 0 ? <option value="">Loading events…</option> : null}
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
            {e.eventDate ? ` · ${new Date(e.eventDate).toLocaleDateString()}` : ""}
          </option>
        ))}
      </select>

      {/* Acknowledged but still open — no alarm, still visible. */}
      {open.some((a) => a.status === "acknowledged") ? (
        <div className="space-y-2 rounded-2xl bg-card p-4 ring-1 ring-cherry/30">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            Acknowledged · still open
          </p>
          {open
            .filter((a) => a.status === "acknowledged")
            .map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                onFocus={() => {
                  setFocusRider(a.userId);
                  setView("map");
                }}
                onResolve={() =>
                  void resolve({ data: { id: a.id } }).then(() => void sosQ.refetch())
                }
              />
            ))}
        </div>
      ) : null}

      {/* Soft safety warnings — never a siren, never competing with real SOS. */}
      {stopped.length > 0 || offCourseRiders.length > 0 ? (
        <details className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-300" open>
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            Watch list · {stopped.length} stopped · {offCourseRiders.length} off course
          </summary>
          <div className="mt-3 space-y-1.5">
            {stopped.map((r) => (
              <button
                key={`s-${r.userId}`}
                type="button"
                onClick={() => {
                  setFocusRider(r.userId);
                  setView("map");
                }}
                className="block w-full text-left text-xs text-amber-900"
              >
                <span className="font-bold">{r.riderName ?? "Unnamed rider"}</span>
                {r.bib ? ` (#${r.bib})` : ""} — stopped for{" "}
                {Math.round((r.stoppedForMs ?? 0) / 60_000)} min
              </button>
            ))}
            {offCourseRiders.map((r) => (
              <button
                key={`o-${r.userId}`}
                type="button"
                onClick={() => {
                  setFocusRider(r.userId);
                  setView("map");
                }}
                className="block w-full text-left text-xs text-amber-900"
              >
                <span className="font-bold">{r.riderName ?? "Unnamed rider"}</span>
                {r.bib ? ` (#${r.bib})` : ""} — about{" "}
                {Math.round((offCourse[r.userId] ?? 0) / 100) / 10} km off the course line
              </button>
            ))}
          </div>
        </details>
      ) : null}

      {selected ? (
        view === "map" ? (
          <LiveTrackingMap
            eventId={selected}
            isCrew
            focusUserId={focusRider}
            onOffCourse={setOffCourse}
          />
        ) : (
          <TriageList riders={riders} alerts={open} onFocus={(u) => { setFocusRider(u); setView("map"); }} />
        )
      ) : (
        <p className="text-sm text-muted-foreground">Pick an event to see live rider positions.</p>
      )}

      {alerts.filter((a) => a.status !== "active" && a.status !== "acknowledged").length > 0 ? (
        <details className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-ink-soft">
            Closed alerts ({alerts.length - open.length})
          </summary>
          <div className="mt-3 space-y-2">
            {alerts
              .filter((a) => a.status !== "active" && a.status !== "acknowledged")
              .map((a) => (
                <p key={a.id} className="text-xs text-ink-soft">
                  {a.riderName ?? "Unknown rider"} · {reasonLabel(a.reason)} · {a.status} ·{" "}
                  {new Date(a.createdAt).toLocaleString()}
                  {a.acknowledgedByName ? ` · seen by ${a.acknowledgedByName}` : ""}
                </p>
              ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function AlertCard({
  alert,
  onAcknowledge,
  onResolve,
  onFocus,
}: {
  alert: SosAlert;
  onAcknowledge?: () => void;
  onResolve: () => void;
  onFocus: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-card p-3 ring-1 ring-cherry/30">
      <button type="button" onClick={onFocus} className="text-left text-sm">
        <p className="font-black text-cherry">{reasonLabel(alert.reason)}</p>
        <p className="font-bold text-ink">
          {alert.riderName ?? "Unknown rider"}
          {alert.bib ? ` · #${alert.bib}` : ""}
        </p>
        <p className="text-xs text-ink-soft">
          {ago(alert.createdAt)} ·{" "}
          {alert.lat != null && alert.lng != null ? (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${alert.lat},${alert.lng}&travelmode=driving`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-cherry underline"
            >
              Navigate
            </a>
          ) : (
            "no GPS fix"
          )}
        </p>
        {alert.note ? <p className="mt-1 text-xs text-ink">{alert.note}</p> : null}
        {alert.acknowledgedByName ? (
          <p className="mt-1 text-xs text-ink-soft">
            Acknowledged by {alert.acknowledgedByName}
            {alert.acknowledgedAt ? ` · ${ago(alert.acknowledgedAt)}` : ""}
          </p>
        ) : null}
      </button>
      <div className="flex shrink-0 flex-col gap-1.5">
        {onAcknowledge ? (
          <button
            type="button"
            onClick={onAcknowledge}
            className="rounded-lg bg-cherry px-2.5 py-1.5 text-xs font-bold text-white"
          >
            Acknowledge
          </button>
        ) : null}
        <button
          type="button"
          onClick={onResolve}
          className="rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-bold text-secondary-foreground"
        >
          Resolve
        </button>
      </div>
    </div>
  );
}

type SortKey = "lastSeen" | "name" | "category" | "stopped";

/** Sortable dispatch table — a map alone can't triage 300 riders. */
function TriageList({
  riders,
  alerts,
  onFocus,
}: {
  riders: LiveRiderPosition[];
  alerts: SosAlert[];
  onFocus: (userId: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>("lastSeen");
  const [showFinished, setShowFinished] = useState(false);
  const sosUsers = new Set(alerts.map((a) => a.userId));

  const rows = useMemo(() => {
    const list = riders.filter((r) => showFinished || !r.finished);
    const score = (r: LiveRiderPosition) => new Date(r.recordedAt).getTime();
    list.sort((a, b) => {
      const sosDiff = Number(sosUsers.has(b.userId)) - Number(sosUsers.has(a.userId));
      if (sosDiff !== 0) return sosDiff;
      if (sort === "name") return (a.riderName ?? "").localeCompare(b.riderName ?? "");
      if (sort === "category") return (a.category ?? "").localeCompare(b.category ?? "");
      if (sort === "stopped") return (b.stoppedForMs ?? 0) - (a.stoppedForMs ?? 0);
      return score(a) - score(b); // oldest last-seen first
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riders, sort, showFinished, alerts]);

  const finishedCount = riders.filter((r) => r.finished).length;

  return (
    <div className="rounded-2xl bg-card ring-1 ring-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        {(
          [
            ["lastSeen", "Oldest signal"],
            ["stopped", "Stopped longest"],
            ["name", "Name"],
            ["category", "Category"],
          ] as [SortKey, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSort(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${
              sort === key ? "bg-cherry text-white ring-cherry" : "bg-card text-ink ring-border"
            }`}
          >
            {label}
          </button>
        ))}
        {finishedCount > 0 ? (
          <button
            type="button"
            onClick={() => setShowFinished((s) => !s)}
            className="ml-auto rounded-full bg-card px-3 py-1.5 text-xs font-bold text-ink ring-1 ring-border"
          >
            {showFinished ? "Hide" : "Show"} finished ({finishedCount})
          </button>
        ) : null}
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No riders tracking yet today.</p>
        ) : null}
        {rows.map((r) => {
          const age = Date.now() - new Date(r.recordedAt).getTime();
          const signal =
            age > LOST_SIGNAL_MS ? "Lost signal" : age > STALE_MS ? "Stale" : "Live";
          return (
            <button
              key={r.userId}
              type="button"
              onClick={() => onFocus(r.userId)}
              className="flex w-full items-center justify-between gap-3 border-b border-border/60 p-3 text-left last:border-0 hover:bg-accent"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">
                  {sosUsers.has(r.userId) ? "🚨 " : ""}
                  {r.riderName ?? "Unnamed rider"}
                  {r.bib ? ` · #${r.bib}` : ""}
                </p>
                <p className="truncate text-xs text-ink-soft">
                  {[r.category, r.batch].filter(Boolean).join(" · ") || "—"}
                  {r.finished ? " · finished" : ""}
                  {r.stoppedForMs
                    ? ` · stopped ${Math.round(r.stoppedForMs / 60_000)} min`
                    : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`text-xs font-bold ${
                    signal === "Live"
                      ? "text-emerald-600"
                      : signal === "Stale"
                        ? "text-amber-600"
                        : "text-muted-foreground"
                  }`}
                >
                  {signal}
                </p>
                <p className="text-[11px] text-ink-soft">{ago(r.recordedAt)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
