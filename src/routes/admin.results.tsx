import { visibleInBackend } from "@/lib/event-window";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import Papa from "papaparse";
import { FileUp, Save, Trash2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  checkMyriadRace,
  deleteResultSet,
  getEventResults,
  importEventResults,
  saveResultsSettings,
  type EventResultsPayload,
  type MyriadRacePreview,
} from "@/lib/results.functions";

export const Route = createFileRoute("/admin/results")({
  component: ResultsAdminPage,
});

const FIELDS: { key: string; label: string; hints: string[] }[] = [
  { key: "position", label: "Position", hints: ["pos", "position", "place", "rank", "#"] },
  { key: "bib_number", label: "Bib number", hints: ["bib", "race number", "number", "no"] },
  { key: "full_name", label: "Rider name", hints: ["name", "rider", "full name", "athlete"] },
  { key: "category", label: "Category", hints: ["category", "cat", "class"] },
  { key: "batch", label: "Batch / group", hints: ["batch", "group", "wave", "start group"] },
  { key: "time_text", label: "Time", hints: ["time", "finish", "elapsed", "chip"] },
  { key: "gap_text", label: "Gap", hints: ["gap", "behind", "diff"] },
  { key: "status", label: "Status", hints: ["status", "dnf", "result"] },
];

function autoMap(headers: string[]) {
  const map: Record<string, string> = {};
  for (const f of FIELDS) {
    const hit = headers.find((h) => {
      const n = h.trim().toLowerCase();
      return f.hints.some((x) => n === x || n.includes(x));
    });
    if (hit) map[f.key] = hit;
  }
  return map;
}

function ResultsAdminPage() {
  const qc = useQueryClient();
  const [eventId, setEventId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [label, setLabel] = useState("Overall");
  const [kind, setKind] = useState("overall");
  const [sortOrder, setSortOrder] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});

  const [resultsUrl, setResultsUrl] = useState("");
  const [riderTemplate, setRiderTemplate] = useState("");
  const [published, setPublished] = useState(false);
  const [raceId, setRaceId] = useState("");
  const [feedPreview, setFeedPreview] = useState<MyriadRacePreview | null>(null);
  const [settingsLoadedFor, setSettingsLoadedFor] = useState<string | null>(null);

  const eventsQ = useQuery({
    queryKey: ["admin-events-basic"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, event_date, days")
        .order("event_date", { ascending: false });
      return visibleInBackend((data ?? []) as { id: string; name: string; event_date: string; days?: unknown[] }[]);
    },
  });

  const fetchResults = useServerFn(getEventResults);
  const resultsQ = useQuery<EventResultsPayload>({
    queryKey: ["admin-event-results", eventId],
    queryFn: () => fetchResults({ data: { eventId } }),
    enabled: !!eventId,
  });

  // Sync settings form when a new event's data arrives.
  if (eventId && resultsQ.data && settingsLoadedFor !== eventId) {
    setResultsUrl(resultsQ.data.results_url ?? "");
    setRiderTemplate(resultsQ.data.results_rider_url_template ?? "");
    setPublished(resultsQ.data.results_published);
    setSettingsLoadedFor(eventId);
  }

  const saveSettings = useServerFn(saveResultsSettings);
  const runImport = useServerFn(importEventResults);
  const removeSet = useServerFn(deleteResultSet);

  const preview = useMemo(() => rows.slice(0, 5), [rows]);

  function onFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const parsed = (res.data ?? []).filter((r) => Object.values(r).some((v) => (v ?? "").trim()));
        const hs = res.meta.fields ?? Object.keys(parsed[0] ?? {});
        setHeaders(hs);
        setRows(parsed);
        setColumnMap(autoMap(hs));
        setMsg(`${parsed.length} rows loaded from ${file.name}`);
      },
      error: () => setMsg("Could not read that CSV."),
    });
  }

  async function handleSaveSettings() {
    if (!eventId) return;
    setBusy(true);
    try {
      await saveSettings({
        data: {
          eventId,
          results_url: resultsUrl.trim() || null,
          results_rider_url_template: riderTemplate.trim() || null,
          results_published: published,
        },
      });
      setMsg("Results settings saved.");
      void qc.invalidateQueries({ queryKey: ["admin-event-results", eventId] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!eventId || rows.length === 0) return;
    setBusy(true);
    try {
      const res = await runImport({
        data: {
          eventId,
          label: label.trim() || "Results",
          kind,
          sortOrder,
          columnMap,
          rows,
          mode: "replace",
        },
      });
      setMsg(`Imported ${res.imported} result rows into “${label}”.`);
      setRows([]);
      setHeaders([]);
      void qc.invalidateQueries({ queryKey: ["admin-event-results", eventId] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 pb-16">
      <header className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-cherry" />
        <h1 className="font-display text-xl font-bold text-ink">Results</h1>
      </header>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Event</span>
        <select
          value={eventId}
          onChange={(e) => {
            setEventId(e.target.value);
            setSettingsLoadedFor(null);
          }}
          className="mt-1 w-full rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-border"
        >
          <option value="">Select an event…</option>
          {(eventsQ.data ?? []).map((e: any) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>

      {msg ? <p className="rounded-xl bg-accent px-3 py-2 text-xs text-cherry-deep">{msg}</p> : null}

      {eventId ? (
        <>
          <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
            <h2 className="font-display text-sm font-bold text-ink">Results links</h2>
            <label className="mt-3 block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                Official results page URL
              </span>
              <input
                value={resultsUrl}
                onChange={(e) => setResultsUrl(e.target.value)}
                placeholder="https://timing.example.com/event/123"
                className="mt-1 w-full rounded-xl bg-background px-3 py-2 text-sm ring-1 ring-border"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                Per-rider results link template
              </span>
              <input
                value={riderTemplate}
                onChange={(e) => setRiderTemplate(e.target.value)}
                placeholder="https://timing.example.com/athlete?bib={bib}"
                className="mt-1 w-full rounded-xl bg-background px-3 py-2 text-sm ring-1 ring-border"
              />
              <span className="mt-1 block text-[11px] text-ink-soft">
                Use {"{bib}"} where the rider’s bib number goes.
              </span>
            </label>
            <label className="mt-3 flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              Publish imported results to riders
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={handleSaveSettings}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cherry px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> Save
            </button>
          </section>

          <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
            <h2 className="font-display text-sm font-bold text-ink">Import results CSV</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Set name</span>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-background px-3 py-2 text-sm ring-1 ring-border"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Type</span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-background px-3 py-2 text-sm ring-1 ring-border"
                >
                  <option value="overall">Overall</option>
                  <option value="stage">Stage / day</option>
                  <option value="gc">General classification</option>
                  <option value="category">Category</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Order</span>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl bg-background px-3 py-2 text-sm ring-1 ring-border"
                />
              </label>
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-sm text-ink-soft">
              <FileUp className="h-4 w-4 text-cherry" />
              Choose a results CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </label>

            {headers.length > 0 ? (
              <>
                <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                  Map columns
                </h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {FIELDS.map((f) => (
                    <label key={f.key} className="flex items-center gap-2 text-xs">
                      <span className="w-28 shrink-0 text-ink-soft">{f.label}</span>
                      <select
                        value={columnMap[f.key] ?? ""}
                        onChange={(e) =>
                          setColumnMap((m) => ({ ...m, [f.key]: e.target.value }))
                        }
                        className="w-full rounded-lg bg-background px-2 py-1.5 ring-1 ring-border"
                      >
                        <option value="">— not in file —</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="text-ink-soft">
                        {headers.map((h) => (
                          <th key={h} className="px-2 py-1 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          {headers.map((h) => (
                            <td key={h} className="whitespace-nowrap px-2 py-1 text-ink">
                              {r[h]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={handleImport}
                  className="mt-4 rounded-xl bg-cherry px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Import {rows.length} rows
                </button>
              </>
            ) : null}
          </section>

          <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
            <h2 className="font-display text-sm font-bold text-ink">Imported sets</h2>
            {(resultsQ.data?.sets ?? []).length === 0 ? (
              <p className="mt-2 text-xs text-ink-soft">Nothing imported yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {resultsQ.data!.sets.map((s) => {
                  const count = resultsQ.data!.rows.filter((r) => r.result_set_id === s.id).length;
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 rounded-xl bg-background p-3 text-sm ring-1 ring-border"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">{s.label}</p>
                        <p className="text-[11px] text-ink-soft">
                          {s.kind} · {count} rows
                          {s.imported_at
                            ? ` · ${new Date(s.imported_at).toLocaleDateString("en-ZA")}`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Delete ${s.label}`}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await removeSet({ data: { setId: s.id } });
                            void qc.invalidateQueries({ queryKey: ["admin-event-results", eventId] });
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="rounded-lg p-2 text-ink-soft hover:text-cherry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
