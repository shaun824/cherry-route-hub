import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import { BedDouble, FileUp, MapPin, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchRooming, fetchVenues, type Venue } from "@/lib/rooming";
import { fetchVillageMap } from "@/lib/village-map";

export const Route = createFileRoute("/admin/rooming")({
  component: RoomingAdminPage,
});

const SAMPLE = `full_name,email,tent_number,room_type,notes,location_hint
Jane Doe,jane@example.com,T14,Twin tent,Shares with John Doe,Row C behind the bar
`;

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const hit = Object.keys(row).find((h) => h.trim().toLowerCase() === k.toLowerCase());
    if (hit && row[hit] != null && String(row[hit]).trim() !== "") return String(row[hit]).trim();
  }
  return "";
}

type ParsedRow = {
  full_name: string;
  email: string;
  tent_number: string;
  room_type: string;
  notes: string;
  location_hint: string;
};

function parseCsv(text: string): ParsedRow[] {
  const res = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
  });
  return (res.data ?? [])
    .map((r) => ({
      full_name:
        pick(r, ["full_name", "name", "Full Name", "Rider"]) ||
        [pick(r, ["First Name"]), pick(r, ["Last Name"])].filter(Boolean).join(" "),
      email: pick(r, ["email", "Email"]),
      tent_number: pick(r, ["tent_number", "tent", "Tent Number", "Tent", "room", "Room", "room_number", "Room Number"]),
      room_type: pick(r, ["room_type", "Room Type", "Tent Type", "type"]),
      notes: pick(r, ["notes", "Notes", "Comment"]),
      location_hint: pick(r, ["location_hint", "location", "Location", "Where", "Block", "Area"]),
    }))
    .filter((r) => r.full_name || r.email || r.tent_number);
}

function RoomingAdminPage() {
  const qc = useQueryClient();
  const [eventId, setEventId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const eventsQ = useQuery({
    queryKey: ["admin-events-basic"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, event_date")
        .order("event_date", { ascending: false });
      return data ?? [];
    },
  });

  const venuesQ = useQuery({
    queryKey: ["admin-venues", eventId],
    queryFn: () => fetchVenues(eventId),
    enabled: !!eventId,
  });

  const villageQ = useQuery({
    queryKey: ["admin-village-spots", eventId],
    queryFn: () => fetchVillageMap(eventId),
    enabled: !!eventId,
  });

  const roomingQ = useQuery({
    queryKey: ["admin-rooming", eventId],
    queryFn: () => fetchRooming(eventId),
    enabled: !!eventId,
  });

  const venues = venuesQ.data ?? [];
  const rows = roomingQ.data ?? [];

  const byVenue = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.venue_id ?? "unassigned";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return map;
  }, [rows]);

  async function addVenue(name: string, address: string) {
    if (!eventId || !name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("event_venues").insert({
      event_id: eventId,
      name: name.trim(),
      address: address.trim() || null,
      sort_order: venues.length,
    });
    setBusy(false);
    if (error) setMsg(error.message);
    else {
      setMsg(null);
      void qc.invalidateQueries({ queryKey: ["admin-venues", eventId] });
    }
  }

  async function saveVenue(v: Venue) {
    setBusy(true);
    const { error } = await supabase
      .from("event_venues")
      .update({ name: v.name, address: v.address, notes: v.notes, village_spot_id: v.village_spot_id })
      .eq("id", v.id);
    setBusy(false);
    setMsg(error ? error.message : "Venue saved.");
    void qc.invalidateQueries({ queryKey: ["admin-venues", eventId] });
  }

  async function deleteVenue(id: string) {
    if (!confirm("Delete this venue? Its rooming rows will become unassigned.")) return;
    setBusy(true);
    await supabase.from("event_venues").delete().eq("id", id);
    setBusy(false);
    void qc.invalidateQueries({ queryKey: ["admin-venues", eventId] });
    void qc.invalidateQueries({ queryKey: ["admin-rooming", eventId] });
  }

  async function importRows(venueId: string, parsed: ParsedRow[], replace: boolean) {
    if (!eventId || parsed.length === 0) return;
    setBusy(true);
    setMsg(null);

    // Match riders to entrants by email so the allocation shows on their report.
    const emails = parsed.map((p) => p.email.toLowerCase()).filter(Boolean);
    const entrantByEmail = new Map<string, string>();
    if (emails.length) {
      const { data } = await supabase.from("entrants").select("id, email").in("email", emails);
      for (const e of data ?? []) {
        if (e.email) entrantByEmail.set(e.email.toLowerCase(), e.id);
      }
    }

    if (replace) {
      await supabase.from("event_rooming").delete().eq("event_id", eventId).eq("venue_id", venueId);
    }

    const payload = parsed.map((p) => ({
      event_id: eventId,
      venue_id: venueId,
      entrant_id: p.email ? entrantByEmail.get(p.email.toLowerCase()) ?? null : null,
      full_name: p.full_name || p.email || "Unnamed",
      email: p.email || null,
      tent_number: p.tent_number || null,
      room_type: p.room_type || null,
      notes: p.notes || null,
      location_hint: p.location_hint || null,
    }));

    const { error } = await supabase.from("event_rooming").insert(payload);
    setBusy(false);
    if (error) setMsg(error.message);
    else {
      const matched = payload.filter((p) => p.entrant_id).length;
      setMsg(`Imported ${payload.length} allocations · ${matched} matched to riders by email.`);
      void qc.invalidateQueries({ queryKey: ["admin-rooming", eventId] });
    }
  }

  async function deleteRow(id: string) {
    await supabase.from("event_rooming").delete().eq("id", id);
    void qc.invalidateQueries({ queryKey: ["admin-rooming", eventId] });
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl font-bold text-ink">Accommodation & rooming lists</h1>
        <p className="text-sm text-ink-soft">
          Add each venue for an event, then upload that venue's rooming list. Riders see their own tent
          or room number on their event report.
        </p>
      </header>

      <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
        <label className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">Event</label>
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Select an event…</option>
          {(eventsQ.data ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      {msg ? (
        <p className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-cherry-deep">{msg}</p>
      ) : null}

      {eventId ? (
        <>
          <VenueManager
            spots={villageQ.data?.hotspots ?? []}
            venues={venues}
            busy={busy}
            onAdd={addVenue}
            onSave={saveVenue}
            onDelete={deleteVenue}
          />

          {venues.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-ink-soft">
              Add a venue first — even single-venue events need one so the rooming list has a home.
            </p>
          ) : (
            venues.map((v) => (
              <VenueRooming
                key={v.id}
                venue={v}
                rows={byVenue.get(v.id) ?? []}
                busy={busy}
                onImport={(parsed, replace) => void importRows(v.id, parsed, replace)}
                onDeleteRow={(id) => void deleteRow(id)}
              />
            ))
          )}
        </>
      ) : null}
    </div>
  );
}

function VenueManager({
  spots,
  venues,
  busy,
  onAdd,
  onSave,
  onDelete,
}: {
  spots: { id: string; title: string }[];
  venues: Venue[];
  busy: boolean;
  onAdd: (name: string, address: string) => void | Promise<void>;
  onSave: (v: Venue) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [edits, setEdits] = useState<Record<string, Venue>>({});

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
        <MapPin className="h-4 w-4 text-cherry" /> Venues
      </h2>

      <div className="mt-3 space-y-2">
        {venues.map((v) => {
          const cur = edits[v.id] ?? v;
          return (
            <div key={v.id} className="grid gap-2 rounded-xl bg-secondary/60 p-3 md:grid-cols-[1fr_1.5fr_1fr_auto]">
              <input
                value={cur.name}
                onChange={(e) => setEdits((s) => ({ ...s, [v.id]: { ...cur, name: e.target.value } }))}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                placeholder="Venue name"
              />
              <input
                value={cur.address ?? ""}
                onChange={(e) => setEdits((s) => ({ ...s, [v.id]: { ...cur, address: e.target.value } }))}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                placeholder="Address (optional)"
              />
              <select
                value={cur.village_spot_id ?? ""}
                onChange={(e) =>
                  setEdits((s) => ({ ...s, [v.id]: { ...cur, village_spot_id: e.target.value || null } }))
                }
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                title="Village map point crew use to find this venue"
              >
                <option value="">Village point…</option>
                {spots.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.title}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onSave(cur)}
                  className="inline-flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-bold text-white"
                >
                  <Save className="h-3.5 w-3.5" /> Save
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onDelete(v.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-ink-soft"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1.5fr_auto]">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New venue name (e.g. Addo Main Camp)"
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address (optional)"
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => {
            void onAdd(name, address);
            setName("");
            setAddress("");
          }}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-cherry px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Add venue
        </button>
      </div>
    </section>
  );
}

function VenueRooming({
  venue,
  rows,
  busy,
  onImport,
  onDeleteRow,
}: {
  venue: Venue;
  rows: { id: string; full_name: string; email: string | null; tent_number: string | null; room_type: string | null; notes: string | null; entrant_id: string | null }[];
  busy: boolean;
  onImport: (parsed: ParsedRow[], replace: boolean) => void;
  onDeleteRow: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [replace, setReplace] = useState(true);
  const parsed = useMemo(() => (text.trim() ? parseCsv(text) : []), [text]);

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
        <BedDouble className="h-4 w-4 text-cherry" /> {venue.name}
        <span className="text-xs font-semibold text-ink-soft">· {rows.length} allocated</span>
      </h2>

      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-ink">
            <FileUp className="h-3.5 w-3.5" /> Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setText(await file.text());
                e.target.value = "";
              }}
            />
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            Replace this venue's existing list
          </label>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder={SAMPLE}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px]"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy || parsed.length === 0}
            onClick={() => {
              onImport(parsed, replace);
              setText("");
            }}
            className="rounded-lg bg-cherry px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            Import {parsed.length || ""} rows
          </button>
          <span className="text-[11px] text-ink-soft">
            Columns: full_name, email, tent_number, room_type, notes
          </span>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-widest text-ink-soft">
              <tr className="border-b border-border">
                <th className="py-1.5">Name</th>
                <th>Email</th>
                <th>Tent / room</th>
                <th>Type</th>
                <th>Linked</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-1.5 font-semibold text-ink">{r.full_name}</td>
                  <td className="text-ink-soft">{r.email ?? "—"}</td>
                  <td className="font-bold text-ink">{r.tent_number ?? "—"}</td>
                  <td className="text-ink-soft">{r.room_type ?? "—"}</td>
                  <td className={r.entrant_id ? "text-emerald-600" : "text-ink-soft"}>
                    {r.entrant_id ? "Matched" : "Unmatched"}
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => onDeleteRow(r.id)}
                      className="rounded p-1 text-ink-soft hover:text-cherry"
                      aria-label="Remove allocation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
