import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, CheckCircle2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import {
  approveAuditFix,
  dismissAuditIssue,
  listContentAudits,
  restoreAuditIssue,
  runContentAuditNow,
} from "@/lib/content-audit.functions";

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
  key?: string;
  severity: "high" | "medium" | "low";
  area: string;
  eventId?: string | null;
  eventName: string;
  message: string;
  fix?: string;
  action?: { kind: string; label: string; [k: string]: unknown };
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

  const q = useQuery({ queryKey: ["content-audits"], queryFn: () => list() });

  const m = useMutation({
    mutationFn: () => run(),
    onSuccess: (res: any) => {
      toast.success(res.summary);
      qc.invalidateQueries({ queryKey: ["content-audits"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useServerFn(approveAuditFix);
  const approveM = useMutation({
    mutationFn: (i: Issue) =>
      approve({
        data: {
          issueKey: i.key!,
          area: i.area,
          message: i.message,
          action: i.action as never,
        },
      }),
    onSuccess: (r: any) => {
      toast.success(r.message ?? "Change applied");
      qc.invalidateQueries({ queryKey: ["content-audits"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismiss = useServerFn(dismissAuditIssue);
  const dismissM = useMutation({
    mutationFn: (i: Issue) =>
      dismiss({
        data: { issueKey: i.key!, area: i.area, eventId: i.eventId, message: i.message },
      }),
    onSuccess: () => {
      toast.success("Warning dismissed");
      qc.invalidateQueries({ queryKey: ["content-audits"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useServerFn(restoreAuditIssue);
  const restoreM = useMutation({
    mutationFn: (issueKey: string) => restore({ data: { issueKey } }),
    onSuccess: () => {
      toast.success("Warning restored");
      qc.invalidateQueries({ queryKey: ["content-audits"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const runs = (q.data?.runs ?? []) as any[];
  const resolutions = (q.data?.resolutions ?? []) as any[];
  const latest = runs[0];
  const resolvedKeys = new Set(resolutions.map((r) => r.issue_key));
  const issues = ((latest?.issues ?? []) as Issue[]).filter(
    (i) => !i.key || !resolvedKeys.has(i.key),
  );

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
            Runs automatically every day at 03:00 and cross-checks event dates, itinerary times,
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
                      {i.key ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {i.action ? (
                            <button
                              onClick={() => approveM.mutate(i)}
                              disabled={approveM.isPending}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Approve: {i.action.label}
                            </button>
                          ) : null}
                          <button
                            onClick={() => dismissM.mutate(i)}
                            disabled={dismissM.isPending}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-[12px] font-semibold text-ink-soft ring-1 ring-border disabled:opacity-60"
                          >
                            <X className="h-3.5 w-3.5" />
                            Dismiss
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}

      {resolutions.length > 0 && (
        <section className="mt-6 rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="font-display text-base font-bold">Approved &amp; dismissed</h2>
          <p className="mt-1 text-[12px] text-ink-soft">
            These warnings stay hidden from the report. Restore one to see it again.
          </p>
          <ul className="mt-3 space-y-2">
            {resolutions.map((r) => (
              <li
                key={r.issue_key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="text-ink">{r.message ?? r.issue_key}</p>
                  <p className="text-[11px] text-ink-soft">
                    {r.status === "approved" ? "Approved" : "Dismissed"} ·{" "}
                    {new Date(r.resolved_at).toLocaleString()}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => restoreM.mutate(r.issue_key)}
                  disabled={restoreM.isPending}
                  className="rounded-lg bg-card px-3 py-1.5 text-[12px] font-semibold text-ink-soft ring-1 ring-border disabled:opacity-60"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </section>
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
