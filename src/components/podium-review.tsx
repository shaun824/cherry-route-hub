// Admin: check the automatic podium, adjust it, then publish (shown from the reveal time).
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, Trophy, X } from "lucide-react";
import { getPodiumReview, publishPodium, unpublishPodium, sendResultsIssueReport } from "@/lib/podium.functions";
import { Button } from '@/components/ui/button';
import type { PodiumStanding } from "@/lib/podium.server";
import { groupStandings } from "@/components/podium-section";

export function PodiumReview({ eventId }: { eventId: string }) {
  const review = useServerFn(getPodiumReview);
  const publish = useServerFn(publishPodium);
  const unpublish = useServerFn(unpublishPodium);
  const emailReport = useServerFn(sendResultsIssueReport);
  const q = useQuery({ queryKey: ["podium-review", eventId], queryFn: () => review({ data: { eventId } }) });
  const [edit, setEdit] = useState<PodiumStanding[]>([]);
  const [reveal, setReveal] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!q.data) return;
    setEdit(q.data.standings);
    setReveal(q.data.revealAt ? q.data.revealAt.slice(0, 16) : "");
  }, [q.data]);

  if (!q.data) return null;
  const d = q.data;
  const update = (key: string, fn: (r: PodiumStanding["riders"]) => PodiumStanding["riders"]) =>
    setEdit((e) => e.map((s) => (s.key === key ? { ...s, riders: fn(s.riders) } : s)));

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
        <Trophy className="h-5 w-5 text-cherry" /> Podium check
      </h2>
      <p className="mt-1 text-xs text-ink-soft">
        Worked out from the timing results ({d.stagesWithResults} of {d.totalStages || "?"} stages in). Riders only see this after you publish and the reveal time passes; until then they see the provisional top 3. Remove or move riders up, then publish — the top 3 in each list are used.
      </p>
      {d.publishedAt ? (
        <p className="mt-2 rounded-lg bg-accent px-2 py-1 text-xs font-semibold text-ink">
          Final podium published {new Date(d.publishedAt).toLocaleString("en-ZA")}.
        </p>
      ) : null}
      {d.missingGender.length > 0 ? (
        <details className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-ink">
          <summary className="cursor-pointer font-bold">Gender missing ({d.missingGender.length}) — not ranked</summary>
          <ul className="mt-1 space-y-0.5">
            {d.missingGender.map((m) => (
              <li key={m.name}>{m.name} · {m.bib ?? "no number"} · {m.category}</li>
            ))}
          </ul>
          <p className="mt-1 text-ink-soft">Fix their gender on Entry Ninja, then sync the event.</p>
        </details>
      ) : null}
      {d.courseMismatches.length > 0 ? (
        <details className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-ink">
          <summary className="cursor-pointer font-bold">Course mismatch ({d.courseMismatches.length}) — not ranked</summary>
          <ul className="mt-1 space-y-1">
            {d.courseMismatches.map((r) => (
              <li key={`${r.bib ?? ""}-${r.name}`}>
                <strong>{r.name}</strong>{r.bib ? ` · #${r.bib}` : ""} · Entry: {r.category} · Timed: {r.courses.join(", ")}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {d.issues?.length ? <details open className="mt-3 border-l-2 border-destructive pl-3 text-xs text-ink">
        <summary className="cursor-pointer font-bold">Results issues ({d.issues.length}) — review before prize-giving</summary>
        <ul className="mt-2 space-y-2">{d.issues.map((issue, i) => <li key={i}><strong>{issue.name}{issue.bib ? ` · #${issue.bib}` : ''}</strong><p className="text-ink-soft">{issue.detail}</p></li>)}</ul>
        <Button variant="outline" size="sm" className="mt-3" disabled={busy} onClick={async () => {
          setBusy(true); setMsg(null);
          try { const result = await emailReport({ data: { eventId } }); setMsg(result.sent ? 'Issue report sent to Shaun.' : result.reason === 'recipient_suppressed' ? 'Shaun’s address is blocked from app emails; report not sent.' : 'No issues to email.'); }
          catch (error) { setMsg(error instanceof Error ? error.message : 'Report could not be sent.'); }
          finally { setBusy(false); }
        }}>Email issue report to Shaun</Button>
      </details> : null}
      <div className="mt-3 space-y-4">
        {groupStandings(edit).map(([group, cats]) => (
          <div key={group}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-cherry">{group}</p>
            <div className="mt-1 grid gap-2 md:grid-cols-2">
              {cats.map((c) => (
                <div key={c.key} className="rounded-xl bg-background p-2 ring-1 ring-border">
                  <p className="text-sm font-bold text-ink">{c.title}</p>
                  {c.riders.length === 0 ? <p className="text-xs text-ink-soft">No ranked riders</p> : null}
                  <ol className="mt-1 space-y-0.5">
                    {c.riders.map((r, i) => (
                      <li key={r.name + i} className={`flex items-center gap-1.5 text-xs ${i < 3 ? "font-bold text-ink" : "text-ink-soft"}`}>
                        <span className="w-4">{i + 1}.</span>
                        <span className="min-w-0 flex-1 truncate">{r.name}{r.bib ? ` (#${r.bib})` : ""}</span>
                        <span className="font-mono">{r.time}</span>
                        <button type="button" aria-label="Move up" disabled={i === 0} className="p-0.5 disabled:opacity-30"
                          onClick={() => update(c.key, (rs) => { const n = [...rs]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" aria-label="Remove" className="p-0.5 text-destructive"
                          onClick={() => update(c.key, (rs) => rs.filter((_, j) => j !== i))}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-ink-soft">
          Show to riders from
          <input type="datetime-local" value={reveal} onChange={(e) => setReveal(e.target.value)}
            className="mt-1 block rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-ink" />
        </label>
        <button type="button" disabled={busy}
          className="rounded-lg bg-cherry px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              await publish({ data: {
                eventId,
                revealAt: reveal ? new Date(`${reveal.slice(0, 16)}:00+02:00`).toISOString() : null,
                standings: edit.map((s) => ({ ...s, riders: s.riders.slice(0, 3) })),
              } });
              setMsg("Final podium published.");
              await q.refetch();
            } catch (e) {
              setMsg((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}>
          Publish final podium
        </button>
        {d.publishedAt ? (
          <button type="button" disabled={busy} className="rounded-lg px-3 py-2 text-sm font-semibold text-ink ring-1 ring-border"
            onClick={async () => { setBusy(true); try { await unpublish({ data: { eventId } }); setMsg("Unpublished."); await q.refetch(); } finally { setBusy(false); } }}>
            Unpublish
          </button>
        ) : null}
        <button type="button" className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft" onClick={() => void q.refetch()}>Refresh</button>
      </div>
      {msg ? <p className="mt-2 text-xs font-semibold text-ink">{msg}</p> : null}
    </section>
  );
}
