import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { listContentAudits, runContentAuditNow } from "@/lib/content-audit.functions";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "Content check · Red Cherry Events admin" },
      { name: "description", content: "Automatic consistency checks across events, itineraries, routes and rider info." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AuditPage,
});

type Issue = {
  severity: "high" | "medium" | "low";
  area: string;
  eventName: string;
  message: string;
  fix?: string;
};

const sevStyles: Record<Issue["severity"], string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-secondary text-ink-soft",
};

function AuditPage() {
  const list = useServerFn(listContentAudits);
  const run = useServerFn(runContentAuditNow);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["content-audits"], queryFn: () => list({ data: {} }) });

  const m = useMutation({
    mutationFn: () => run({ data: {} }),
    onSuccess: (res: any) => {
      toast.success(res.summary);
      qc.invalidateQueries({ queryKey: ["content-audits"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runs = (q.data?.runs ?? []) as any[];
  const latest = runs[0];
  const issues = (latest?.issues ?? []) as Issue[];

  const grouped = issues.reduce<Record<string, Issue[]>>((acc, i) => {
    (acc[i.eventName] ??= []).push(i);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Routine content check</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Runs automatically every 2 days at 03:00 and cross-checks event dates, itinerary times,
            route distances, packing lists, rosters and rooming against each other.
          </p>
        </div>
        <button
          onClick={() => m.mutate()}
          disabled={m.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-cherry px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${m.isPending ? "animate-spin" : ""}`} />
          Run check now
        </button>
      </div>

      {q.isLoading && <p className="text-sm text-ink-soft">Loading…</p>}

      {!q.isLoading && !latest && (
        <div className="rounded-2xl bg-card p-6 text-sm text-ink-soft ring-1 ring-border">
          No check has run yet. Hit “Run check now” to see the first report.
        </div>
      )}

      {latest && (
        <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <div className="flex items-center gap-3">
            {latest.issue_count === 0 ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            )}
            <div>
              <p className="font-semibold text-ink">{latest.summary}</p>
              <p className="text-[11px] text-ink-soft">
                Last run {new Date(latest.run_at).toLocaleString()} · {latest.events_checked} events checked
              </p>
            </div>
          </div>
          {latest.error && <p className="mt-3 text-sm text-red-600">{latest.error}</p>}

          <div className="mt-5 space-y-4">
            {Object.entries(grouped).map(([eventName, list]) => (
              <section key={eventName} className="rounded-xl bg-secondary/50 p-4">
                <h2 className="font-display text-sm font-bold text-ink">{eventName}</h2>
                <ul className="mt-2 space-y-2">
                  {list.map((i, idx) => (
                    <li key={idx} className="rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-border">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${sevStyles[i.severity]}`}>
                          {i.severity}
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                          {i.area}
                        </span>
                      </div>
                      <p className="mt-1 text-ink">{i.message}</p>
                      {i.fix && <p className="mt-0.5 text-[12px] text-ink-soft">Fix: {i.fix}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}

      {runs.length > 1 && (
        <section className="mt-6 rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            <ShieldCheck className="h-4 w-4 text-cherry" /> Previous checks
          </h2>
          <ul className="mt-3 space-y-2">
            {runs.slice(1).map((r) => (
              <li key={r.id} className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                <p className="font-semibold text-ink">{r.summary}</p>
                <p className="text-[11px] text-ink-soft">{new Date(r.run_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
