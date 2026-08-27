import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Search, RefreshCw, Eye, X, MailOpen, MousePointerClick } from "lucide-react";
import {
  listEmailDeliveryLogs,
  listEmailTemplates,
  previewEmailTemplate,
  listSentEmails,
  getSentEmail,
  type EmailLogResult,
  type EmailTemplateInfo,
  type SentEmailRow,
  type SentEmailDetail,
} from "@/lib/email-logs.functions";

export const Route = createFileRoute("/admin/emails")({
  head: () => ({
    meta: [
      { title: "Email log · Red Cherry Admin" },
      { name: "description", content: "See every app email Red Cherry Events has sent, who received it, and preview exactly how it looked." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: EmailsAdmin,
});

const TYPES = [
  { key: "", label: "All" },
  { key: "sent", label: "Sent" },
  { key: "bounced", label: "Bounced" },
  { key: "complained", label: "Complaints" },
  { key: "unsubscribed", label: "Unsubscribed" },
  { key: "suppressed", label: "Blocked" },
  { key: "rejected", label: "Rejected" },
  { key: "rate_limited", label: "Rate limited" },
] as const;

const TYPE_STYLE: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  bounced: "bg-red-50 text-red-700 border-red-200",
  complained: "bg-red-50 text-red-700 border-red-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  unsubscribed: "bg-amber-50 text-amber-700 border-amber-200",
  suppressed: "bg-amber-50 text-amber-700 border-amber-200",
  rate_limited: "bg-amber-50 text-amber-700 border-amber-200",
};

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function EmailsAdmin() {
  const fetchLogs = useServerFn(listEmailDeliveryLogs);
  const fetchTemplates = useServerFn(listEmailTemplates);
  const renderPreview = useServerFn(previewEmailTemplate);

  const [type, setType] = useState<string>("");
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const [sentSearch, setSentSearch] = useState("");

  const fetchSent = useServerFn(listSentEmails);
  const fetchSentOne = useServerFn(getSentEmail);

  const sent = useQuery({
    queryKey: ["admin", "sent-emails", sentSearch],
    queryFn: () =>
      fetchSent({ data: { recipient: sentSearch.trim() || undefined, limit: 100 } }) as Promise<SentEmailRow[]>,
  });

  const sentDetail = useQuery({
    queryKey: ["admin", "sent-email", sentId],
    enabled: Boolean(sentId),
    queryFn: () => fetchSentOne({ data: { id: sentId as string } }) as Promise<SentEmailDetail>,
  });

  const logs = useQuery({
    queryKey: ["admin", "email-logs", type],
    queryFn: () => fetchLogs({ data: { eventType: type || undefined, limit: 100 } }) as Promise<EmailLogResult>,
  });

  const templates = useQuery({
    queryKey: ["admin", "email-templates"],
    queryFn: () => fetchTemplates({}) as Promise<EmailTemplateInfo[]>,
  });

  const previewQuery = useQuery({
    queryKey: ["admin", "email-preview", preview],
    enabled: Boolean(preview),
    queryFn: () => renderPreview({ data: { name: preview as string } }) as Promise<{ html: string; subject: string }>,
  });

  const rows = logs.data?.rows ?? [];
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.recipient.toLowerCase().includes(term) || (r.status ?? "").toLowerCase().includes(term));
  }, [rows, q]);

  const stats = useMemo(() => {
    const count = (t: string) => rows.filter((r) => r.event_type === t).length;
    return {
      sent: count("sent"),
      bounced: count("bounced"),
      unsubscribed: count("unsubscribed"),
      blocked: count("suppressed") + count("rejected"),
    };
  }, [rows]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-xl font-bold">
            <Mail className="h-5 w-5" /> Email log
          </h1>
          <p className="text-sm text-ink-soft">Every app email we've sent, who received it, and what happened to it.</p>
        </div>
        <button
          onClick={() => void logs.refetch()}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${logs.isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Sent", value: stats.sent },
          { label: "Bounced", value: stats.bounced },
          { label: "Unsubscribed", value: stats.unsubscribed },
          { label: "Blocked", value: stats.blocked },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3">
            <div className="text-xl font-bold">{s.value}</div>
            <div className="text-[11px] uppercase tracking-wide text-ink-soft">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Open a mail to see how it looks</h2>
        <p className="mt-1 text-xs text-ink-soft">These are the live templates — exactly what lands in a rider's inbox.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(templates.data ?? []).map((t) => (
            <button
              key={t.name}
              onClick={() => setPreview(t.name)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs font-semibold"
            >
              <Eye className="h-3.5 w-3.5" /> {t.displayName}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Mail we've sent</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Open any row to read the exact mail that person got, whether they opened it, and every link they clicked.
            </p>
          </div>
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
            <input
              value={sentSearch}
              onChange={(e) => setSentSearch(e.target.value)}
              placeholder="Search recipient"
              className="w-56 rounded-lg border border-border bg-card py-1.5 pl-8 pr-3 text-xs"
            />
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          {sent.isLoading ? (
            <p className="p-3 text-sm text-ink-soft">Loading sent mail…</p>
          ) : sent.isError ? (
            <p className="p-3 text-sm text-red-600">Couldn't load sent mail: {(sent.error as Error).message}</p>
          ) : (sent.data ?? []).length === 0 ? (
            <p className="p-3 text-sm text-ink-soft">
              No stored mail yet — every mail sent from now on is recorded here with open and click tracking.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {(sent.data ?? []).map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setSentId(s.id)}
                    className="flex w-full flex-wrap items-center gap-2 p-3 text-left hover:bg-secondary/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.recipient}</span>
                      <span className="block truncate text-[11px] text-ink-soft">{s.subject}</span>
                    </span>
                    {s.opened_at ? (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        <MailOpen className="h-3 w-3" /> Opened {s.open_count > 1 ? `${s.open_count}×` : ""}
                      </span>
                    ) : (
                      <span className="rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[11px] text-ink-soft">
                        Not opened
                      </span>
                    )}
                    {s.click_count > 0 ? (
                      <span className="flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                        <MousePointerClick className="h-3 w-3" /> {s.click_count} click
                        {s.click_count === 1 ? "" : "s"}
                      </span>
                    ) : null}
                    <span className="text-[11px] text-ink-soft">{when(s.sent_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>


      <div className="flex flex-wrap items-center gap-2">
        {TYPES.map((t) => (
          <button
            key={t.key || "all"}
            onClick={() => setType(t.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              type === t.key ? "border-ink bg-ink text-white" : "border-border bg-card"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search recipient"
            className="w-56 rounded-lg border border-border bg-card py-1.5 pl-8 pr-3 text-xs"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {logs.isLoading ? (
          <p className="p-4 text-sm text-ink-soft">Loading email history…</p>
        ) : logs.isError ? (
          <p className="p-4 text-sm text-red-600">Couldn't load the email log: {(logs.error as Error).message}</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-ink-soft">No email events in this window.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r, i) => (
              <li key={`${r.message_id ?? i}-${r.timestamp}`} className="flex flex-wrap items-center gap-2 p-3">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    TYPE_STYLE[r.event_type] ?? "bg-secondary/50 text-ink-soft border-border"
                  }`}
                >
                  {r.event_type}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.recipient}</span>
                {r.status ? <span className="text-[11px] text-ink-soft">{r.status}</span> : null}
                <span className="text-[11px] text-ink-soft">{when(r.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {logs.data ? (
        <p className="text-[11px] text-ink-soft">
          History visible from {when(logs.data.history_starts_at)}. Open and click tracking isn't recorded on our email
          platform — we log sends, bounces, complaints, unsubscribes and blocked sends.
        </p>
      ) : null}

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={() => setPreview(null)}>
          <div
            className="flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{previewQuery.data?.subject ?? "Loading…"}</div>
                <div className="text-[11px] text-ink-soft">{preview}</div>
              </div>
              <button onClick={() => setPreview(null)} className="rounded-lg border border-border p-1.5">
                <X className="h-4 w-4" />
              </button>
            </div>
            {previewQuery.data ? (
              <iframe title="Email preview" srcDoc={previewQuery.data.html} className="h-full w-full flex-1 bg-white" />
            ) : (
              <p className="p-4 text-sm text-ink-soft">Rendering the mail…</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
