import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileUp, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { importRoster, quickAddEntrant, unassignEntrant } from "@/lib/roster.functions";

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

      <QuickAddSection events={eventsQ.data ?? []} onAdded={() => qc.invalidateQueries({ queryKey: ["admin-entrants"] })} />

      <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
        <div className="flex items-center gap-2 pb-3">
          <Users className="h-5 w-5 text-cherry" />
          <h2 className="font-display text-base font-bold text-ink">Entrants ({entrantsQ.data?.length ?? 0})</h2>
        </div>
        {entrantsQ.isLoading ? (
          <p className="text-sm text-ink-soft">Loading…</p>
        ) : (entrantsQ.data ?? []).length === 0 ? (
          <p className="text-sm text-ink-soft">No entrants yet — add one above or import a CSV.</p>
        ) : (
          <EntrantsTable
            rows={entrantsQ.data ?? []}
            eventNameById={eventNameById}
            onChanged={() => qc.invalidateQueries({ queryKey: ["admin-entrants"] })}
          />
        )}
      </section>
    </div>
  );
}

function EntrantsTable({
  rows,
  eventNameById,
  onChanged,
}: {
  rows: any[];
  eventNameById: Map<string, string>;
  onChanged: () => void;
}) {
  const unassignFn = useServerFn(unassignEntrant);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        (r.full_name ?? "").toLowerCase().includes(needle) ||
        (r.email ?? "").toLowerCase().includes(needle),
    );
  }, [q, rows]);

  async function remove(entrant_id: string, event_id: string) {
    if (!confirm("Remove this rider from that event?")) return;
    try {
      await unassignFn({ data: { entrant_id, event_id } });
      onChanged();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name or email"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />
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
            {filtered.map((e: any) => (
              <tr key={e.id} className="border-t border-border align-top">
                <td className="py-2 font-semibold text-ink">{e.full_name}</td>
                <td>{e.email}</td>
                <td>{e.id_number_last4 ?? "—"}</td>
                <td>
                  {(e.event_entrants ?? []).length === 0 ? (
                    <span className="text-ink-soft">—</span>
                  ) : (
                    <ul className="space-y-1">
                      {(e.event_entrants ?? []).map((ee: any) => (
                        <li key={ee.event_id} className="flex items-center gap-1">
                          <span className="rounded bg-secondary px-1.5 py-0.5">
                            {eventNameById.get(ee.event_id) ?? ee.event_id.slice(0, 8)}
                          </span>
                          {ee.category ? (
                            <span className="rounded bg-accent px-1 py-0.5 text-[10px] text-cherry-deep">
                              {ee.category}
                            </span>
                          ) : null}
                          {ee.batch ? (
                            <span className="rounded bg-ink px-1 py-0.5 text-[10px] text-white">
                              {ee.batch}
                            </span>
                          ) : null}
                          <button
                            onClick={() => void remove(e.id, ee.event_id)}
                            className="text-cherry hover:text-cherry-deep"
                            title="Remove from event"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td>{e.user_id ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Assignment = { event_id: string; category: string; batch: string; bib_number: string };

function QuickAddSection({
  events,
  onAdded,
}: {
  events: { id: string; name: string; event_date: string }[];
  onAdded: () => void;
}) {
  const addFn = useServerFn(quickAddEntrant);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([
    { event_id: "", category: "", batch: "", bib_number: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function update(i: number, patch: Partial<Assignment>) {
    setAssignments((a) => a.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const valid = assignments.filter((a) => a.event_id);
      if (valid.length === 0) throw new Error("Pick at least one event to tag this rider to.");
      const res = await addFn({
        data: {
          full_name: fullName,
          email,
          id_number: idNumber,
          phone,
          assignments: valid,
        },
      });
      setMsg({ kind: "ok", text: `Saved. Linked to ${res.linked} event${res.linked === 1 ? "" : "s"}.` });
      setFullName("");
      setEmail("");
      setIdNumber("");
      setPhone("");
      setAssignments([{ event_id: "", category: "", batch: "", bib_number: "" }]);
      onAdded();
    } catch (err) {
      setMsg({ kind: "err", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <div className="flex items-center gap-2 pb-3">
        <UserPlus className="h-5 w-5 text-cherry" />
        <h2 className="font-display text-base font-bold text-ink">Add rider & tag to events</h2>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Labeled label="Full name">
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="input-lg" placeholder="Jane Doe" />
          </Labeled>
          <Labeled label="Email">
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="input-lg" placeholder="jane@example.com" />
          </Labeled>
          <Labeled label="ID number">
            <input required value={idNumber} onChange={(e) => setIdNumber(e.target.value)}
              className="input-lg" placeholder="9204115000080" />
          </Labeled>
          <Labeled label="Phone (optional)">
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              className="input-lg" placeholder="+27 82 000 0000" />
          </Labeled>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Events</p>
          {assignments.map((a, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 rounded-lg border border-border bg-background p-2">
              <select
                value={a.event_id}
                onChange={(e) => update(i, { event_id: e.target.value })}
                className="col-span-12 rounded-md border border-border bg-card px-2 py-1.5 text-sm md:col-span-5"
              >
                <option value="">— select event —</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({new Date(ev.event_date).toLocaleDateString("en-ZA")})
                  </option>
                ))}
              </select>
              <input
                value={a.category}
                onChange={(e) => update(i, { category: e.target.value })}
                placeholder="Category"
                className="col-span-4 rounded-md border border-border bg-card px-2 py-1.5 text-sm md:col-span-3"
              />
              <input
                value={a.batch}
                onChange={(e) => update(i, { batch: e.target.value })}
                placeholder="Batch"
                className="col-span-4 rounded-md border border-border bg-card px-2 py-1.5 text-sm md:col-span-2"
              />
              <input
                value={a.bib_number}
                onChange={(e) => update(i, { bib_number: e.target.value })}
                placeholder="Bib #"
                className="col-span-3 rounded-md border border-border bg-card px-2 py-1.5 text-sm md:col-span-1"
              />
              <button
                type="button"
                onClick={() => setAssignments((arr) => arr.filter((_, idx) => idx !== i))}
                className="col-span-1 grid place-items-center rounded-md text-ink-soft hover:text-cherry"
                aria-label="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAssignments((a) => [...a, { event_id: "", category: "", batch: "", bib_number: "" }])}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-secondary"
          >
            <Plus className="h-3.5 w-3.5" /> Add another event
          </button>
        </div>

        {msg ? (
          <p className={`text-xs ${msg.kind === "ok" ? "text-emerald-700" : "text-cherry"}`}>{msg.text}</p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg cherry-gradient px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save rider"}
        </button>
      </form>
      <style>{`.input-lg{width:100%;border-radius:.5rem;border:1px solid hsl(var(--border));background:hsl(var(--background));padding:.5rem .7rem;font-size:.875rem}`}</style>
    </section>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
