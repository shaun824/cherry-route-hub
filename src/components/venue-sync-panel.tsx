import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Globe, Loader2, RefreshCw, Check } from "lucide-react";
import { getVenueSync, runVenueSync, applyScrapedVenues } from "@/lib/venue-scrape.functions";

type Stay = {
  nightIndex: number | null;
  date?: string | null;
  venue: string;
  town?: string | null;
  address?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  notes?: string | null;
  source?: string | null;
};

/** Pulls the night-by-night venue list off the event's public website. */
export function VenueSyncPanel({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);

  const get = useServerFn(getVenueSync);
  const run = useServerFn(runVenueSync);
  const apply = useServerFn(applyScrapedVenues);

  const syncQ = useQuery({
    queryKey: ["venue-sync", eventId],
    queryFn: () => get({ data: { eventId } }),
    enabled: Boolean(eventId),
  });

  const runM = useMutation({
    mutationFn: () => run({ data: { eventId } }),
    onSuccess: (res: any) => {
      const r = res?.results?.[0];
      setMsg(r?.error ? r.error : `Found ${r?.found ?? 0} overnight venue${r?.found === 1 ? "" : "s"}.`);
      void qc.invalidateQueries({ queryKey: ["venue-sync", eventId] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const applyM = useMutation({
    mutationFn: () => apply({ data: { eventId } }),
    onSuccess: (res: any) => {
      setMsg(`Applied — ${res.created} added, ${res.updated} updated.`);
      void qc.invalidateQueries({ queryKey: ["admin-venues", eventId] });
      void qc.invalidateQueries({ queryKey: ["venue-sync", eventId] });
    },
    onError: (e: Error) => setMsg(e.message),
  });

  const sync = (syncQ.data as any)?.sync ?? null;
  const stays: Stay[] = (sync?.stays as Stay[]) ?? [];

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <Globe className="h-4 w-4 text-cherry" /> Where the event moves to
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={runM.isPending}
            onClick={() => runM.mutate()}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-ink"
          >
            {runM.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Check website
          </button>
          <button
            type="button"
            disabled={applyM.isPending || stays.length === 0}
            onClick={() => applyM.mutate()}
            className="inline-flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" /> Apply to venues
          </button>
        </div>
      </div>

      <p className="mt-1 text-xs text-ink-soft">
        Reads the event's public pages and lists the overnight venues night by night. Nothing changes
        until you apply it.
      </p>

      {msg ? (
        <p className="mt-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-cherry-deep">{msg}</p>
      ) : null}

      {sync?.last_error ? (
        <p className="mt-2 text-xs font-semibold text-destructive">{sync.last_error}</p>
      ) : null}

      {stays.length ? (
        <ul className="mt-3 space-y-2">
          {stays.map((s, i) => (
            <li key={i} className="rounded-xl bg-secondary/60 p-3 text-sm">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  {s.nightIndex ? `Night ${s.nightIndex}` : "Night ?"}
                </span>
                <span className="font-semibold text-ink">{s.venue}</span>
                {s.date ? <span className="text-xs text-ink-soft">{s.date}</span> : null}
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {[s.town, s.address].filter(Boolean).join(" · ")}
                {s.checkIn || s.checkOut
                  ? ` · check-in ${s.checkIn ?? "—"} / out ${s.checkOut ?? "—"}`
                  : ""}
              </p>
              {s.notes ? <p className="mt-1 text-xs text-ink-soft">{s.notes}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-ink-soft">
          {sync?.synced_at ? "Nothing found on the website yet." : "Not checked yet."}
        </p>
      )}

      {sync?.synced_at ? (
        <p className="mt-2 text-[11px] text-ink-soft">
          Last checked {new Date(sync.synced_at).toLocaleString("en-ZA")}
          {sync.applied_at ? ` · applied ${new Date(sync.applied_at).toLocaleString("en-ZA")}` : ""}
        </p>
      ) : null}
    </section>
  );
}
