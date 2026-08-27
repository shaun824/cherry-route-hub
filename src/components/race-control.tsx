// Race control: live rider map + SOS alert list for a chosen event.
// Shared by the admin console and the crew portal (crew + admin only).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radar, RefreshCw, Siren } from "lucide-react";
import { LiveTrackingMap } from "@/components/live-tracking-map";
import { fetchSosAlerts, fetchTrackingEvents, resolveSosAlert } from "@/lib/tracking.functions";

export function RaceControlPanel({ title = "Live tracking" }: { title?: string }) {
  const queryClient = useQueryClient();
  const [eventId, setEventId] = useState<string | null>(null);
  const resolve = useServerFn(resolveSosAlert);

  const eventsQ = useQuery({
    queryKey: ["tracking-events"],
    queryFn: () => fetchTrackingEvents(),
  });
  const events = eventsQ.data ?? [];
  const selected = eventId ?? events[0]?.id ?? null;

  const sosQ = useQuery({
    queryKey: ["tracking-sos", selected],
    queryFn: () => fetchSosAlerts({ data: { eventId: selected } }),
    enabled: Boolean(selected),
    refetchInterval: 15_000,
  });
  const alerts = sosQ.data?.alerts ?? [];
  const active = alerts.filter((a) => a.status === "active");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-cherry" />
          <h1 className="font-display text-lg font-bold text-ink">{title}</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: ["tracking-sos"] });
            void queryClient.invalidateQueries({ queryKey: ["live-tracking"] });
          }}
          className="flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-xs font-semibold text-ink ring-1 ring-border hover:bg-accent"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <select
        value={selected ?? ""}
        onChange={(e) => setEventId(e.target.value || null)}
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

      {active.length > 0 ? (
        <div className="rounded-2xl border-2 border-cherry/40 bg-cherry/5 p-4">
          <div className="flex items-center gap-2">
            <Siren className="h-5 w-5 text-cherry" />
            <p className="font-display text-base font-bold text-ink">
              {active.length} active SOS alert{active.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="mt-3 space-y-2">
            {active.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-xl bg-card p-3 ring-1 ring-cherry/30"
              >
                <div className="text-sm">
                  <p className="font-bold text-ink">{a.riderName ?? "Unknown rider"}</p>
                  <p className="text-xs text-ink-soft">
                    {new Date(a.createdAt).toLocaleString()} ·{" "}
                    {a.lat != null && a.lng != null ? (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-cherry underline"
                      >
                        {a.lat.toFixed(5)}, {a.lng.toFixed(5)}
                      </a>
                    ) : (
                      "no GPS fix"
                    )}
                  </p>
                  {a.message ? <p className="mt-1 text-xs text-ink">{a.message}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void resolve({ data: { id: a.id } }).then(() =>
                      queryClient.invalidateQueries({ queryKey: ["tracking-sos"] }),
                    )
                  }
                  className="shrink-0 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-bold text-secondary-foreground"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {selected ? (
        <LiveTrackingMap eventId={selected} />
      ) : (
        <p className="text-sm text-muted-foreground">Pick an event to see live rider positions.</p>
      )}

      {alerts.filter((a) => a.status !== "active").length > 0 ? (
        <details className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-ink-soft">
            Resolved alerts ({alerts.length - active.length})
          </summary>
          <div className="mt-3 space-y-2">
            {alerts
              .filter((a) => a.status !== "active")
              .map((a) => (
                <p key={a.id} className="text-xs text-ink-soft">
                  {a.riderName ?? "Unknown rider"} · {new Date(a.createdAt).toLocaleString()}
                </p>
              ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
