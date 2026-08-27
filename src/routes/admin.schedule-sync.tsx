import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Check, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  applyScrapedSchedule,
  listScheduleSyncs,
  runScheduleSync,
  setScheduleAutoApply,
} from "@/lib/schedule-scrape.functions";

export const Route = createFileRoute("/admin/schedule-sync")({
  head: () => ({
    meta: [
      { title: "Schedule sync · Red Cherry Events admin" },
      {
        name: "description",
        content: "Scrape event websites for the latest programme and keep app schedules up to date.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ScheduleSyncPage,
});

function fmt(ts?: string | null) {
  if (!ts) return "never";
  return new Date(ts).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

function ScheduleSyncPage() {
  const list = useServerFn(listScheduleSyncs);
  const run = useServerFn(runScheduleSync);
  const apply = useServerFn(applyScrapedSchedule);
  const setAuto = useServerFn(setScheduleAutoApply);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["schedule-syncs"], queryFn: () => list() });
  const rows = (q.data?.rows ?? []) as any[];

  const refresh = () => qc.invalidateQueries({ queryKey: ["schedule-syncs"] });

  const syncAll = useMutation({
    mutationFn: () => run({ data: {} }),
    onSuccess: (res: any) => {
      const found = res.results.reduce((n: number, r: any) => n + r.found, 0);
      toast.success(`Checked ${res.results.length} websites — ${found} schedule items found`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncOne = useMutation({
    mutationFn: (eventId: string) => run({ data: { eventId } }),
    onSuccess: (res: any) => {
      const r = res.results[0];
      if (r?.error) toast.error(`${r.name}: ${r.error}`);
      else toast.success(`${r.name}: ${r.found} items found${r.applied ? " and applied" : ""}`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyOne = useMutation({
    mutationFn: (eventId: string) => apply({ data: { eventId } }),
    onSuccess: (res: any) => {
      toast.success(`Applied ${res.applied} schedule items`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAuto = useMutation({
    mutationFn: (v: { eventId: string; autoApply: boolean }) => setAuto({ data: v }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Schedule sync</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Reads the programme / itinerary off each event's official website every day at 04:00 and
            keeps the app schedule (event pages, spectator hub, crew dashboard and the rider bot) in
            step with it. Turn off auto-update for an event you've hand-tuned.
          </p>
        </div>
        <button
          onClick={() => syncAll.mutate()}
          disabled={syncAll.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-cherry px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${syncAll.isPending ? "animate-spin" : ""}`} />
          Check all websites
        </button>
      </div>

      {q.isLoading && <p className="text-sm text-ink-soft">Loading…</p>}

      <div className="space-y-3">
        {rows.map((row) => {
          const sync = row.sync;
          const items = (sync?.items ?? []) as any[];
          const autoApply = sync?.auto_apply ?? true;
          return (
            <div key={row.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-base font-bold">{row.name}</h2>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {row.scheduleCount} items live
                    </span>
                    <span>Last checked {fmt(sync?.synced_at)}</span>
                    {sync?.needs_review ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                        Needs review
                      </span>
                    ) : sync?.verified ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                        Verified
                      </span>
                    ) : null}
                    {sync?.applied_at ? <span>Applied {fmt(sync.applied_at)}</span> : null}
                    {row.websiteUrl ? (
                      <a
                        href={row.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-cherry"
                      >
                        Website <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-amber-600">No website set</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={autoApply}
                      onChange={(e) =>
                        toggleAuto.mutate({ eventId: row.id, autoApply: e.target.checked })
                      }
                    />
                    Auto-update
                  </label>
                  <button
                    onClick={() => syncOne.mutate(row.id)}
                    disabled={syncOne.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Check now
                  </button>
                  {items.length > 0 && (
                    <button
                      onClick={() => applyOne.mutate(row.id)}
                      disabled={applyOne.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5" /> Apply {items.length}
                    </button>
                  )}
                </div>
              </div>

              {sync?.last_error ? (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  {sync.last_error}
                </p>
              ) : null}

              {items.length > 0 && (
                <ul className="mt-3 divide-y divide-border rounded-xl bg-secondary/40 text-xs">
                  {items.slice(0, 30).map((i: any, idx: number) => (
                    <li key={idx} className="flex gap-3 px-3 py-2">
                      <span className="w-24 shrink-0 font-semibold text-ink">
                        {i.date ? `${i.date.slice(5)} ` : ""}
                        {i.time}
                      </span>
                      <span className="min-w-0">
                        <span className="font-semibold text-ink">{i.label}</span>
                        {i.details ? <span className="block text-ink-soft">{i.details}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
