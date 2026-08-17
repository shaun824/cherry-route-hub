import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link2, RefreshCw, CheckCircle2, AlertTriangle, Plug, Mail } from "lucide-react";
import {
  listEntryNinjaEvents,
  syncEntryNinjaEvent,
  countEntryWelcomes,
  sendEntryWelcomeBatch,
} from "@/lib/entryninja.functions";

export const Route = createFileRoute("/admin/entry-ninja")({
  component: EntryNinjaPage,
});

type SyncResult = Awaited<ReturnType<typeof syncEntryNinjaEvent>>;

function EntryNinjaPage() {
  const listFn = useServerFn(listEntryNinjaEvents);
  const syncFn = useServerFn(syncEntryNinjaEvent);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const events = useQuery({
    queryKey: ["entry-ninja-events"],
    queryFn: () => listFn({}),
    staleTime: 60_000,
  });

  async function runSync(enId: number) {
    setBusyId(enId);
    setError(null);
    setResult(null);
    try {
      const res = await syncFn({ data: { enEventId: enId } });
      setResult(res);
      void events.refetch();
    } catch (err) {
      setError((err as Error).message ?? "Sync failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex-1 space-y-5 pb-24 md:pb-0">
      <header className="space-y-1">
        <h1 className="font-display text-xl font-bold">Entry Ninja</h1>
        <p className="text-sm text-ink-soft">
          Live connection to your Entry Ninja account. Sync an event to pull every entrant, class,
          batch, race number and apparel size straight into the rider app.
        </p>
      </header>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-xs text-ink-soft">
        <Plug className="h-4 w-4 text-cherry" />
        API key connected · api.entryninja.com
        <button
          onClick={() => void events.refetch()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-semibold text-ink"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${events.isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="space-y-1 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Synced {result.eventName}
          </p>
          <p className="text-ink-soft">
            {result.totalEntries} entries · {result.created} new riders · {result.updated} updated ·{" "}
            {result.linked} linked to the event
            {result.skipped ? ` · ${result.skipped} skipped (no email or ID)` : ""}
            {result.createdEvent ? " · event created as a draft — add the details next" : ""}
          </p>
          {result.errors.length > 0 && (
            <ul className="list-inside list-disc text-xs text-destructive">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {events.isLoading && <p className="text-sm text-ink-soft">Loading events from Entry Ninja…</p>}
      {events.error && (
        <p className="text-sm text-destructive">{(events.error as Error).message}</p>
      )}

      <div className="space-y-2">
        {(events.data ?? []).map((e) => (
          <div
            key={e.enId}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold">{e.name}</p>
              <p className="text-xs text-ink-soft">
                {e.date ? new Date(e.date).toLocaleDateString("en-ZA", { timeZone: "Africa/Johannesburg" }) : "No date"}
                {e.venue ? ` · ${e.venue}` : ""}
                {e.location ? ` · ${e.location}` : ""}
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide">
                {e.matchedEventId ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <Link2 className="h-3 w-3" /> Linked to {e.matchedEventName}
                  </span>
                ) : (
                  <span className="text-amber-600">Not linked yet — sync creates a draft event</span>
                )}
              </p>
            </div>
            <button
              onClick={() => void runSync(e.enId)}
              disabled={busyId !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busyId === e.enId ? "animate-spin" : ""}`} />
              {busyId === e.enId ? "Syncing…" : "Sync entries"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
