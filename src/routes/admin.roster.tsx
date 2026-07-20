import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileUp, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { importRoster } from "@/lib/roster.functions";

export const Route = createFileRoute("/admin/roster")({
  component: RosterPage,
});

type CsvRow = {
  full_name: string;
  email: string;
  id_number: string;
  phone?: string;
  event_id: string;
  category?: string;
  batch?: string;
  bib_number?: string;
};

const SAMPLE = `full_name,email,id_number,phone,event_id,category,batch,bib_number
Jane Doe,jane@example.com,9204115000080,+27820000000,My Event Name,Elite,A,101
`;

function RosterPage() {
  const qc = useQueryClient();
  const importFn = useServerFn(importRoster);

  const eventsQ = useQuery({
    queryKey: ["admin-events-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, event_date")
        .order("event_date", { ascending: true });
      return data ?? [];
    },
  });

  const entrantsQ = useQuery({
    queryKey: ["admin-entrants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("entrants")
        .select(
          "id, full_name, email, phone, id_number_last4, user_id, event_entrants:event_entrants(event_id, category, batch, bib_number)",
        )
        .order("full_name", { ascending: true })
        .limit(500);
      return data ?? [];
    },
  });

  const [defaultEventId, setDefaultEventId] = useState("");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [result, setResult] = useState<{ created: number; updated: number; linkedToEvent: number; errors: { row: number; error: string }[] } | null>(null);

  const eventNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of eventsQ.data ?? []) {
      map.set(e.id, e.name);
    }
    return map;
  }, [eventsQ.data]);

  const eventIdByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of eventsQ.data ?? []) {
      map.set(e.name.trim().toLowerCase(), e.id);
    }
    return map;
  }, [eventsQ.data]);

  function looksLikeUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
  }

  function resolveEventIdLocal(raw: string): { id: string; name: string; isName: boolean } | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const byName = eventIdByName.get(trimmed.toLowerCase());
    if (byName) {
      return { id: byName, name: eventNameById.get(byName) ?? trimmed, isName: true };
    }
    if (looksLikeUuid(trimmed) && eventNameById.has(trimmed)) {
      return { id: trimmed, name: eventNameById.get(trimmed) ?? trimmed, isName: false };
    }
    return null;
  }

  function handleFile(file?: File | null) {
    if (!file) return;
    setResult(null);
    setErrors([]);
    setSelectedFileName(file.name);
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const parsed = (res.data ?? []).map((r) => ({
          full_name: (r.full_name ?? "").trim(),
          email: (r.email ?? "").trim(),
          id_number: (r.id_number ?? "").trim(),
          phone: (r.phone ?? "").trim(),
          event_id: (r.event_id ?? "").trim() || defaultEventId,
          category: (r.category ?? "").trim(),
          batch: (r.batch ?? "").trim(),
          bib_number: (r.bib_number ?? "").trim(),
        }));
        const errs: string[] = [];
        parsed.forEach((r, i) => {
          if (!r.full_name) errs.push(`Row ${i + 1}: missing full_name`);
          if (!r.email) errs.push(`Row ${i + 1}: missing email`);
          if (!r.id_number) errs.push(`Row ${i + 1}: missing id_number`);
          if (!r.event_id) errs.push(`Row ${i + 1}: missing event_id (choose a default event or add an event_id column)`);
          else if (!resolveEventIdLocal(r.event_id)) errs.push(`Row ${i + 1}: event_id '${r.event_id}' did not match any event`);
        });
        setRows(parsed);
        setErrors(errs);
      },
    });
  }

  async function runImport() {
    if (rows.length === 0) return;
    setRunning(true);
    try {
      const res = await importFn({ data: { rows } });
      setResult(res);
      qc.invalidateQueries({ queryKey: ["admin-entrants"] });
    } catch (err) {
      setErrors([(err as Error).message]);
    } finally {
      setRunning(false);
    }
  }

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">Rider roster</h1>
        <p className="text-sm text-ink-soft">
          Upload the CSV export from Entry Ninja (or any spreadsheet with matching headers) to
          make riders' events show up in the app.
        </p>
      </header>

      <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
        <div className="flex items-center gap-2 pb-3">
          <FileUp className="h-5 w-5 text-cherry" />
          <h2 className="font-display text-base font-bold text-ink">CSV import</h2>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Default event (used when a row has no event_id)
            </span>
            <select
              value={defaultEventId}
              onChange={(e) => setDefaultEventId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">— none —</option>
              {(eventsQ.data ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({new Date(e.event_date).toLocaleDateString("en-ZA")})
                </option>
              ))}
            </select>
          </label>

          <div>
            <input
              id="roster-csv-upload"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="sr-only"
            />
            <label
              htmlFor="roster-csv-upload"
              className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-cherry/45 bg-cherry/5 px-4 py-6 text-center transition hover:border-cherry hover:bg-cherry/10"
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cherry text-white shadow-sm">
                <FileUp className="h-6 w-6" />
              </span>
              <span className="mt-3 text-sm font-bold text-ink">Upload CSV document</span>
              <span className="mt-1 text-xs text-ink-soft">
                Tap here to choose your Entry Ninja export from your device.
              </span>
              {selectedFileName ? (
                <span className="mt-3 rounded-full bg-card px-3 py-1 text-[11px] font-semibold text-ink ring-1 ring-border">
                  Selected: {selectedFileName}
                </span>
              ) : null}
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`}
              download="roster-sample.csv"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-ink-soft"
            >
              <Download className="h-3.5 w-3.5" />
              Download sample CSV
            </a>
            <p className="text-[11px] text-ink-soft">
              Required columns: <code>full_name, email, id_number, event_id</code>. Optional:{" "}
              <code>phone, category, batch, bib_number</code>. The <code>event_id</code> column can be
              the event's UUID or the exact event name from Admin → Events.
            </p>
          </div>

          {rows.length > 0 ? (
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="text-xs font-semibold text-ink">
                {rows.length} row{rows.length === 1 ? "" : "s"} parsed
                {errors.length ? ` · ${errors.length} issue${errors.length === 1 ? "" : "s"}` : ""}
              </p>
              {errors.length > 0 ? (
                <ul className="mt-2 max-h-32 overflow-y-auto text-[11px] text-cherry-deep">
                  {errors.slice(0, 20).map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              ) : null}
              <table className="mt-2 w-full text-left text-[11px]">
                <thead className="text-ink-soft">
                  <tr>
                    <th className="py-1">Name</th>
                    <th>Email</th>
                    <th>Event</th>
                    <th>Cat</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => {
                    const resolved = resolveEventIdLocal(r.event_id);
                    return (
                      <tr key={i} className="border-t border-border">
                        <td className="py-1">{r.full_name}</td>
                        <td className="truncate">{r.email}</td>
                        <td className="truncate">
                          {resolved ? (
                            <span className="flex items-center gap-1">
                              {resolved.name}
                              {resolved.isName ? (
                                <span className="rounded bg-cherry/10 px-1 py-0.5 text-[9px] font-bold text-cherry-deep">
                                  by name
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-cherry-deep">{r.event_id.slice(0, 20)}…</span>
                          )}
                        </td>
                        <td>{r.category ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length > 5 ? (
                <p className="mt-1 text-[11px] text-ink-soft">…and {rows.length - 5} more</p>
              ) : null}
              <button
                onClick={() => void runImport()}
                disabled={running || errors.length > 0}
                className="mt-3 rounded-lg cherry-gradient px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {running ? "Importing…" : `Import ${rows.length} rows`}
              </button>
            </div>
          ) : null}

          {result ? (
            <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">
              ✓ Created {result.created}, updated {result.updated}, linked {result.linkedToEvent} event entries.
              {result.errors.length > 0 ? (
                <ul className="mt-1">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>Row {e.row}: {e.error}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
        <div className="flex items-center gap-2 pb-3">
          <Users className="h-5 w-5 text-cherry" />
          <h2 className="font-display text-base font-bold text-ink">Entrants ({entrantsQ.data?.length ?? 0})</h2>
        </div>
        {entrantsQ.isLoading ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : (entrantsQ.data ?? []).length === 0 ? (
          <p className="text-sm text-ink-soft">No entrants yet — import a CSV to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-ink-soft">
                <tr>
                  <th className="py-2">Name</th>
                  <th>Email</th>
                  <th>ID ****</th>
                  <th>Events</th>
                  <th>Linked</th>
                </tr>
              </thead>
              <tbody>
                {(entrantsQ.data ?? []).map((e: any) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="py-2 font-semibold text-ink">{e.full_name}</td>
                    <td>{e.email}</td>
                    <td>{e.id_number_last4 ?? "—"}</td>
                    <td>{e.event_entrants?.length ?? 0}</td>
                    <td>{e.user_id ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
