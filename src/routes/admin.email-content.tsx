import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ExternalLink, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { listEmailContent, markScheduleVerified } from "@/lib/email-content.functions";
import { sendTestEntryWelcome } from "@/lib/entryninja.functions";
import { sendAllEmailSamples, sendScheduleEmailsForAllEvents } from "@/lib/email-samples.functions";

export const Route = createFileRoute("/admin/email-content")({
  head: () => ({
    meta: [
      { title: "Email content · Red Cherry Events admin" },
      {
        name: "description",
        content: "See exactly what times the automatic rider emails print for every event.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: EmailContentPage,
});

function fmt(ts?: string | null) {
  if (!ts) return "never";
  return new Date(ts).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

function EmailContentPage() {
  const list = useServerFn(listEmailContent);
  const verify = useServerFn(markScheduleVerified);
  const test = useServerFn(sendTestEntryWelcome);
  const allSamples = useServerFn(sendAllEmailSamples);
  const allScheduleMails = useServerFn(sendScheduleEmailsForAllEvents);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["email-content"], queryFn: () => list() });
  const rows = (q.data?.rows ?? []) as any[];
  const refresh = () => qc.invalidateQueries({ queryKey: ["email-content"] });

  const confirm = useMutation({
    mutationFn: (eventId: string) => verify({ data: { eventId } }),
    onSuccess: () => {
      toast.success("Marked as correct — emails will print these times");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const preview = useMutation({
    mutationFn: (v: { eventId: string; category?: string | null }) =>
      test({ data: { eventId: v.eventId, ...(v.category ? { category: v.category } : {}) } }),
    onSuccess: () => toast.success("Preview mail sent to your inbox"),
    onError: (e: Error) => toast.error(e.message),
  });

  // One copy of every email the app sends — rider, crew and account mails.
  const samples = useMutation({
    mutationFn: () => allSamples({ data: {} }),
    onSuccess: (r: any) => toast.success(`${r.sent} emails sent to ${r.to}`),
    onError: (e: Error) => toast.error(e.message),
  });

  const scheduleMails = useMutation({
    mutationFn: () => allScheduleMails({ data: {} }),
    onSuccess: (r: any) => toast.success(`${r.sent} schedule emails sent to ${r.to}`),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Email content</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Exactly what the automatic rider emails would print right now, event by event — same
            code path as the real mailer. Anything showing “TBC” is going out without times.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => scheduleMails.mutate()}
            disabled={scheduleMails.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Mail className="h-4 w-4" />
            {scheduleMails.isPending ? "Sending…" : "Send me every event schedule email"}
          </button>
          <button
            onClick={() => samples.mutate()}
            disabled={samples.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-cherry px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Mail className="h-4 w-4" />
            {samples.isPending ? "Sending…" : "Send me every email"}
          </button>
          <button
            onClick={() => refresh()}
            className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white"
          >
            <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {q.isLoading && <p className="text-sm text-ink-soft">Loading…</p>}

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold">{row.name}</h2>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                  <span>Last checked {fmt(row.syncedAt)}</span>
                  {row.showsTbc ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                      Emails show TBC
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                      Real times
                    </span>
                  )}
                  {row.verified ? <span>Verified {fmt(row.verifiedAt)}</span> : null}
                  {row.websiteUrl ? (
                    <a
                      href={row.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-cherry"
                    >
                      Website <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => preview.mutate({ eventId: row.id, category: row.variants[0]?.category })}
                  disabled={preview.isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                >
                  <Mail className="h-3.5 w-3.5" /> Preview the mail
                </button>
                {row.needsReview || !row.verified ? (
                  <button
                    onClick={() => confirm.mutate(row.id)}
                    disabled={confirm.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-cherry px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    <Check className="h-3.5 w-3.5" /> Times are correct
                  </button>
                ) : null}
              </div>
            </div>

            {row.reviewNote ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{row.reviewNote}</p>
            ) : null}
            {row.lastError ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{row.lastError}</p>
            ) : null}

            <div className="mt-3 space-y-3">
              {row.variants.map((v: any, vi: number) => (
                <div key={vi}>
                  {v.category ? (
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                      {v.category}
                    </p>
                  ) : null}
                  {v.days.length === 0 ? (
                    <p className="text-xs text-ink-soft">No schedule in the email yet.</p>
                  ) : (
                    <ul className="divide-y divide-border rounded-xl bg-secondary/40 text-xs">
                      {v.days.map((d: any, di: number) => (
                        <li key={di} className="px-3 py-2">
                          <p className="font-semibold text-ink">
                            {d.label}
                            {d.date ? ` · ${d.date}` : ""}
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {d.items.map((i: any, ii: number) => (
                              <li key={ii} className="flex gap-3">
                                <span
                                  className={`w-16 shrink-0 font-semibold ${
                                    i.time === "TBC" ? "text-amber-600" : "text-ink"
                                  }`}
                                >
                                  {i.time}
                                </span>
                                <span className="min-w-0 text-ink-soft">{i.label}</span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
