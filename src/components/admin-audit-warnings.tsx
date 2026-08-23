// Admin-only home-page card: daily content check warnings with approve/dismiss.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronUp, X } from "lucide-react";
import { toast } from "sonner";
import { useIsAdmin } from "@/lib/auth";
import {
  approveAuditFix,
  dismissAuditIssue,
  getHomeAuditWarnings,
} from "@/lib/content-audit.functions";

type Issue = {
  key?: string;
  severity: "high" | "medium" | "low";
  area: string;
  eventId: string | null;
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

export function AdminAuditWarnings() {
  const { isAdmin } = useIsAdmin();
  const load = useServerFn(getHomeAuditWarnings);
  const approve = useServerFn(approveAuditFix);
  const dismiss = useServerFn(dismissAuditIssue);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["home-audit-warnings"],
    queryFn: () => load(),
    enabled: isAdmin,
    staleTime: 10 * 60_000,
  });

  const approveM = useMutation({
    mutationFn: (i: Issue) =>
      approve({
        data: { issueKey: i.key!, area: i.area, message: i.message, action: i.action as never },
      }),
    onSuccess: (r: any) => {
      toast.success(r.message ?? "Change applied");
      qc.invalidateQueries({ queryKey: ["home-audit-warnings"] });
      qc.invalidateQueries({ queryKey: ["content-audits"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismissM = useMutation({
    mutationFn: (i: Issue) =>
      dismiss({
        data: { issueKey: i.key!, area: i.area, eventId: i.eventId, message: i.message },
      }),
    onSuccess: () => {
      toast.success("Warning dismissed");
      qc.invalidateQueries({ queryKey: ["home-audit-warnings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) return null;

  const issues = ((q.data?.issues ?? []) as Issue[]).filter((i) => i.key);
  const high = issues.filter((i) => i.severity === "high").length;
  const runAt = q.data?.runAt ? new Date(q.data.runAt as string) : null;

  if (q.isLoading) return null;

  if (!issues.length) {
    return (
      <section className="mx-4 mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-ink">Content check passed</p>
            <p className="text-[11px] text-ink-soft">
              {runAt ? `Last checked ${runAt.toLocaleString()}` : "Checked today"} · nothing needs your attention
            </p>
          </div>
        </div>
      </section>
    );
  }

  const shown = open ? issues : issues.slice(0, 3);

  return (
    <section className="mx-4 mt-4 rounded-2xl bg-card p-4 ring-1 ring-amber-300/70">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {issues.length} content warning{issues.length === 1 ? "" : "s"}
            {high > 0 ? ` · ${high} need${high === 1 ? "s" : ""} attention` : ""}
          </p>
          <p className="text-[11px] text-ink-soft">
            Daily accuracy check{runAt ? ` · last run ${runAt.toLocaleString()}` : ""}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {shown.map((i) => (
          <li key={i.key} className="rounded-xl bg-secondary/50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${sevStyles[i.severity]}`}
              >
                {i.severity}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                {i.area} · {i.eventName}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink">{i.message}</p>
            {i.fix && <p className="mt-0.5 text-[12px] text-ink-soft">Fix: {i.fix}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {i.action && (
                <button
                  onClick={() => approveM.mutate(i)}
                  disabled={approveM.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve: {i.action.label}
                </button>
              )}
              <button
                onClick={() => dismissM.mutate(i)}
                disabled={dismissM.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-[12px] font-semibold text-ink-soft ring-1 ring-border disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" />
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3">
        {issues.length > 3 ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-cherry"
          >
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {open ? "Show less" : `Show all ${issues.length}`}
          </button>
        ) : (
          <span />
        )}
        <Link to="/admin/audit" className="text-[12px] font-semibold text-ink-soft underline">
          Full report
        </Link>
      </div>
    </section>
  );
}
