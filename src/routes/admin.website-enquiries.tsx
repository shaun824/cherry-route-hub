import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { csvCell } from "@/lib/security-rules";
import { listWebsiteEnquiries, retryEnquiryEverlytic } from "@/lib/website-enquiries.functions";

export const Route = createFileRoute("/admin/website-enquiries")({
  head: () => ({ meta: [{ title: "Website enquiries · Admin" }, { name: "robots", content: "noindex" }] }),
  component: WebsiteEnquiries,
});

function WebsiteEnquiries() {
  const list = useServerFn(listWebsiteEnquiries);
  const retry = useServerFn(retryEnquiryEverlytic);
  const qc = useQueryClient();
  const [unsyncedOnly, setUnsyncedOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["website-enquiries", unsyncedOnly], queryFn: () => list({ data: { unsyncedOnly } }) });
  const rows = (q.data?.enquiries ?? []) as any[];

  const downloadCsv = () => {
    const header = ["received", "name", "email", "phone", "trip", "question", "consent", "everlytic_synced", "team_notified", "auto_replied"];
    const lines = rows.map((r) => [r.created_at, r.name, r.email, r.phone, r.trip, r.message, r.consent ? "yes" : "no", r.everlytic_synced ? "yes" : "no", r.notified ? "yes" : "no", r.auto_replied ? "yes" : "no"].map(csvCell).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tour-de-addo-website-enquiries.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const resync = async (id: string) => {
    setBusy(id);
    try {
      const r = await retry({ data: { id } });
      toast[r.synced ? "success" : "error"](r.synced ? "Added to Everlytic" : "Everlytic sync failed again");
      await qc.invalidateQueries({ queryKey: ["website-enquiries"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Website enquiries</h1>
        <p className="text-sm text-ink-soft">Questions from the Tour de Addo website contact form, newest first.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold">
          <input type="checkbox" checked={unsyncedOnly} onChange={(e) => setUnsyncedOnly(e.target.checked)} />
          Unsynced to Everlytic
        </label>
        <button onClick={downloadCsv} disabled={!rows.length} className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> Download CSV
        </button>
        <span className="text-xs text-ink-soft">{rows.length} shown</span>
      </div>
      {q.isLoading ? <p className="text-sm text-ink-soft">Loading…</p> : q.error ? <p className="text-sm text-destructive">{(q.error as Error).message}</p> : !rows.length ? (
        <p className="rounded-2xl border border-border bg-card p-4 text-sm text-ink-soft">{unsyncedOnly ? "Everything that opted in is in Everlytic." : "No enquiries yet."}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="space-y-2 rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-ink">{r.name} <a className="text-sm font-normal text-primary underline" href={`mailto:${r.email}`}>{r.email}</a></p>
                <p className="text-xs text-ink-soft">{new Date(r.created_at).toLocaleString("en-ZA")}</p>
              </div>
              <p className="text-xs text-ink-soft">{r.trip}{r.phone ? ` · ${r.phone}` : ""}</p>
              <p className="whitespace-pre-wrap text-sm text-ink">{r.message}</p>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                <span className="rounded-full bg-secondary px-2 py-0.5">{r.notified ? "Team emailed" : "Team email failed"}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5">{r.auto_replied ? "Reply sent" : "No reply sent"}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5">{!r.consent ? "No news opt-in" : r.everlytic_synced ? "In Everlytic" : "Not in Everlytic yet"}</span>
                {r.consent && !r.everlytic_synced ? (
                  <button onClick={() => resync(r.id)} disabled={busy === r.id} className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 disabled:opacity-50">
                    <RefreshCw className={`h-3 w-3 ${busy === r.id ? "animate-spin" : ""}`} /> Retry sync
                  </button>
                ) : null}
              </div>
              {r.everlytic_error && !r.everlytic_synced ? <p className="text-xs text-destructive">{r.everlytic_error}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
