import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link2, RefreshCw, CheckCircle2, AlertTriangle, Plug, Mail, History, Users } from "lucide-react";
import {
  backfillEntryNinjaArchive,
  linkRosterToAccounts,
  rosterCoverage,
} from "@/lib/entryninja-archive.functions";
import {
  listEntryNinjaEvents,
  syncEntryNinjaEvent,
  countEntryWelcomes,
  sendEntryWelcomeBatch,
  sendTestEntryWelcome,

} from "@/lib/entryninja.functions";
import {
  sendScheduleApologyBatch,
  sendTestScheduleApology,
} from "@/lib/schedule-apology.functions";

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

  const [includeClosed, setIncludeClosed] = useState(false);

  const events = useQuery({
    queryKey: ["entry-ninja-events", includeClosed],
    queryFn: () => listFn({ data: { includeClosed } }),
    staleTime: 60_000,
  });

  /** Mailer pickers list every event in the hub, not only Entry Ninja matches. */
  const allEvents = useQuery({
    queryKey: ["admin-all-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, event_date")
        .order("event_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((e) => ({ id: e.id as string, name: e.name as string }));
    },
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
          batch, race number and apparel size straight into the rider app. Only events still open
          for entry are listed and synced — closed events are archived and left alone.
        </p>
        <label className="inline-flex items-center gap-2 pt-1 text-xs font-semibold text-ink-soft">
          <input
            type="checkbox"
            checked={includeClosed}
            onChange={(ev) => setIncludeClosed(ev.target.checked)}
            className="h-3.5 w-3.5 accent-cherry"
          />
          Show closed / archived events
        </label>
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

      <ArchiveBackfillCard />

      <WelcomeEmailsCard events={allEvents.data ?? []} />

      <ScheduleApologyCard events={allEvents.data ?? []} />
    </div>
  );
}

function ArchiveBackfillCard() {
  const runChunk = useServerFn(backfillEntryNinjaArchive);
  const linkFn = useServerFn(linkRosterToAccounts);
  const coverageFn = useServerFn(rosterCoverage);
  const [busy, setBusy] = useState(false);
  const stopRef = useRef(false);
  const [stopping, setStopping] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  /** Where the last "Resend corrected" run stopped, so the next click continues. */
  const [resendCursor, setResendCursor] = useState<string | null>(null);

  const coverage = useQuery({
    queryKey: ["roster-coverage"],
    queryFn: () => coverageFn({}),
    staleTime: 30_000,
  });

  async function runAll() {
    setBusy(true);
    stopRef.current = false;
    setStopping(false);
    setErr(null);
    setLog([]);
    let start = 0;
    try {
      for (;;) {
        const res = await runChunk({ data: { start, count: 3 } });
        setProgress({ done: res.start + res.processed, total: res.total });
        setLog((prev) =>
          [
            ...res.results.map((r) =>
              r.ok
                ? `${r.eventName}: ${r.totalEntries} entries · ${r.created} new riders · ${r.updated} updated`
                : `${r.eventName}: failed — ${r.error}`,
            ),
            ...prev,
          ].slice(0, 60),
        );
        if (res.nextStart == null) break;
        start = res.nextStart;
        if (stopRef.current) break;
      }
      const linkRes = await linkFn({});
      setLog((prev) => [`Linked ${linkRes.linked} roster records to app accounts.`, ...prev]);
      void coverage.refetch();
    } catch (e) {
      setErr((e as Error).message ?? "Backfill failed");
    } finally {
      setBusy(false);
    }
  }

  async function linkOnly() {
    setBusy(true);
    setErr(null);
    try {
      const r = await linkFn({});
      setLog((prev) => [`Linked ${r.linked} of ${r.checked} roster records to app accounts.`, ...prev]);
      void coverage.refetch();
    } catch (e) {
      setErr((e as Error).message ?? "Linking failed");
    } finally {
      setBusy(false);
    }
  }

  const c = coverage.data;

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <header className="flex items-center gap-2">
        <History className="h-4 w-4 text-cherry" />
        <h2 className="font-display text-sm font-bold">Full history backfill</h2>
      </header>
      <p className="text-xs text-ink-soft">
        Walks every event on the Entry Ninja account — including ones never linked here — and pulls
        each entrant into the roster with their ID number stored securely, so anyone who has ever
        entered with us can claim their profile and see their history. Past events that don&rsquo;t
        exist in the app are created as archived records for history only.
      </p>

      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {[
          ["Riders on file", c?.entrants],
          ["With ID number", c?.withIdNumber],
          ["Linked to accounts", c?.linkedToAccounts],
          ["Event entries", c?.entries],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-border bg-background p-2.5">
            <p className="font-display text-base font-bold">{value ?? "…"}</p>
            <p className="text-[11px] text-ink-soft">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => void runAll()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          {busy ? "Pulling history…" : "Pull full history"}
        </button>
        <button
          onClick={() => void linkOnly()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-60"
        >
          <Users className="h-3.5 w-3.5" /> Link riders to accounts
        </button>
        {busy && (
          <button
            onClick={() => {
              stopRef.current = true;
              setStopping(true);
            }}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold"
          >
            {stopping ? "Stopping…" : "Stop after this batch"}
          </button>
        )}
        {progress && (
          <span className="text-xs text-ink-soft">
            {progress.done} of {progress.total} events
          </span>
        )}
      </div>

      {err && <p className="text-xs text-destructive">{err}</p>}
      {log.length > 0 && (
        <ul className="max-h-48 space-y-1 overflow-auto text-[11px] text-ink-soft">
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WelcomeEmailsCard({ events }: { events: { id: string; name: string }[] }) {
  const countFn = useServerFn(countEntryWelcomes);
  const sendFn = useServerFn(sendEntryWelcomeBatch);
  const testFn = useServerFn(sendTestEntryWelcome);

  const [eventId, setEventId] = useState<string>("");
  const [testCategory, setTestCategory] = useState<string>("");
  const [batch, setBatch] = useState(50);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const counts = useQuery({
    queryKey: ["entry-welcome-counts", eventId],
    queryFn: () => countFn({ data: eventId ? { eventId } : {} }),
    staleTime: 15_000,
  });

  async function send(mode: "new" | "backfill" | "resend") {
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const r = await sendFn({
        data: {
          ...(eventId ? { eventId } : {}),
          limit: batch,
          mode,
          ...(mode === "resend" && resendCursor ? { after: resendCursor } : {}),
        },
      });
      if (mode === "resend") setResendCursor(r.nextCursor ?? null);
      setNote(
        `${r.sent} sent · ${r.suppressed} suppressed · ${r.skipped} skipped (no email or draft event)` +
          (mode === "resend"
            ? r.nextCursor
              ? " · click again to carry on down the roster"
              : " · roster complete"
            : "") +
          (r.errors.length ? ` · ${r.errors[0]}` : ""),
      );
      void counts.refetch();
    } catch (e) {
      setErr((e as Error).message ?? "Send failed");
    } finally {
      setBusy(false);
    }
  }

  /** Preview copy to the signed-in admin — no entry records are touched. */
  async function sendTest() {
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const r = await testFn({
        data: {
          ...(eventId ? { eventId } : {}),
          ...(testCategory ? { category: testCategory } : {}),
        },
      });
      setNote(
        r.sent
          ? `Test email sent to ${r.to} for ${r.eventName} (${r.offers} offer${r.offers === 1 ? "" : "s"} listed).`
          : `Not sent to ${r.to}: ${r.reason}`,
      );
    } catch (e) {
      setErr((e as Error).message ?? "Test send failed");
    } finally {
      setBusy(false);
    }
  }



  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <header className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-cherry" />
        <h2 className="font-display text-sm font-bold">Welcome emails</h2>
      </header>
      <p className="text-xs text-ink-soft">
        Every new Entry Ninja entry automatically gets a &ldquo;you&rsquo;re in&rdquo; email that
        explains the app and links straight to that event&rsquo;s page. Use this panel to email an
        existing roster in controlled batches — nobody is ever emailed twice for the same entry.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={eventId}
          onChange={(e) => {
            setEventId(e.target.value);
            setResendCursor(null);
          }}
          className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs"
        >
          <option value="">All linked events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          Batch
          <input
            type="number"
            min={1}
            max={200}
            value={batch}
            onChange={(e) => setBatch(Number(e.target.value) || 50)}
            className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
          />
        </label>
        <button
          onClick={() => void send("new")}
          disabled={busy}
          className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-60"
        >
          Send pending ({counts.data?.pending ?? "…"})
        </button>
        <button
          onClick={() => void send("backfill")}
          disabled={busy}
          className="rounded-lg bg-cherry px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Sending…" : `Backfill existing (${counts.data?.historic ?? "…"})`}
        </button>
        <button
          onClick={() => {
            if (!eventId) {
              setErr("Pick an event first — resends are per event.");
              return;
            }
            if (confirm("Re-send the corrected welcome email to riders already emailed for this event?"))
              void send("resend");
          }}
          disabled={busy}
          className="rounded-lg border border-cherry px-3 py-2 text-xs font-semibold text-cherry disabled:opacity-60"
        >
          {resendCursor ? "Resend corrected (continue)" : "Resend corrected"}
        </button>
        <input
          value={testCategory}
          onChange={(e) => setTestCategory(e.target.value)}
          placeholder="Test as category (optional)"
          className="w-56 rounded-lg border border-border bg-background px-2.5 py-2 text-xs"
        />
        <button
          onClick={() => void sendTest()}
          disabled={busy}
          className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-60"
        >
          Send test to me
        </button>
      </div>


      {note && <p className="text-xs font-semibold text-emerald-700">{note}</p>}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </section>
  );
}

/**
 * One-off correction mail: riders who got "TBC" times before the itinerary was
 * verified get their real, trip-specific schedule with an apology.
 */
function ScheduleApologyCard({ events }: { events: { id: string; name: string }[] }) {
  const testFn = useServerFn(sendTestScheduleApology);
  const sendFn = useServerFn(sendScheduleApologyBatch);

  const [eventId, setEventId] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [onlyEmails, setOnlyEmails] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(kind: "test" | "send") {
    if (!eventId) {
      setErr("Pick an event first");
      return;
    }
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      if (kind === "test") {
        const r = await testFn({
          data: { eventId, ...(category ? { category } : {}) },
        });
        setNote(
          r.sent
            ? `Test apology sent to ${r.to} for ${r.eventName} (${r.days} day${r.days === 1 ? "" : "s"} listed).`
            : `Not sent to ${r.to}: ${r.reason}`,
        );
      } else {
        const emails = onlyEmails
          .split(/[,\s]+/)
          .map((e) => e.trim())
          .filter(Boolean);
        const r = await sendFn({ data: { eventId, ...(emails.length ? { emails } : {}) } });
        setNote(
          `${r.sent} sent · ${r.suppressed} suppressed · ${r.skipped} skipped` +
            (r.errors.length ? ` · ${r.errors[0]}` : ""),
        );
      }
    } catch (e) {
      setErr((e as Error).message ?? "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <header className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-cherry" />
        <h2 className="font-display text-sm font-bold">Schedule correction &amp; apology</h2>
      </header>
      <p className="text-xs text-ink-soft">
        Sends the &ldquo;sorry about the TBC times&rdquo; mail with the rider&rsquo;s real, verified
        schedule. Each rider only sees the trip they are entered for, and nobody is mailed twice.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="rounded-lg border border-border bg-background px-2.5 py-2 text-xs"
        >
          <option value="">Pick an event</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Test as category (optional)"
          className="w-56 rounded-lg border border-border bg-background px-2.5 py-2 text-xs"
        />
        <input
          value={onlyEmails}
          onChange={(e) => setOnlyEmails(e.target.value)}
          placeholder="Only these emails (optional)"
          className="w-64 rounded-lg border border-border bg-background px-2.5 py-2 text-xs"
        />
        <button
          onClick={() => void run("test")}
          disabled={busy}
          className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-60"
        >
          Send test to me
        </button>
        <button
          onClick={() => void run("send")}
          disabled={busy}
          className="rounded-lg bg-cherry px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Sending…" : onlyEmails.trim() ? "Send to listed riders" : "Send to everyone entered"}
        </button>
      </div>

      {note && <p className="text-xs font-semibold text-emerald-700">{note}</p>}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </section>
  );
}
