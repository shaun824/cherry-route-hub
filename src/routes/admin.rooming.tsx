import { visibleInBackend } from "@/lib/event-window";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BedDouble, FileUp, Link2, MapPin, Plus, RefreshCw, Save, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchRooming, fetchVenues, type RoomingRow, type Venue } from "@/lib/rooming";
import { eventNights } from "@/lib/accommodation";
import type { EventDay, ScheduleItem } from "@/lib/mock-data";
import { fetchVillageMap } from "@/lib/village-map";

import type { VillageZone } from "@/lib/village-zones";
import {
  labelsMatch,
  parseRoomingCsv,
  parseRoomingWorkbook,
  type ParsedRoomingRow,
} from "@/lib/rooming-import";
import { syncRoomingSheet } from "@/lib/rooming-sheet.functions";
import { loadEntryCandidates, matchEntry, type EntryCandidate } from "@/lib/rooming-match";
import { fetchTentRules, fetchVillageTents, ruleMatches, tentForLabel, type VillageTent } from "@/lib/village-tents";
import { VenueSyncPanel } from "@/components/venue-sync-panel";

export const Route = createFileRoute("/admin/rooming")({
  component: RoomingAdminPage,
});

const SAMPLE = `full_name,email,tent_number,room_type,notes,location_hint,area
Jane Doe,jane@example.com,T14,Twin tent,Shares with John Doe,Row C behind the bar,Tent 14
`;

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
        .select("id, name, event_date, days")
        .order("event_date", { ascending: false });
      return visibleInBackend((data ?? []) as { id: string; name: string; event_date: string; days?: unknown[] }[]);
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

  const eventDaysQ = useQuery({
    queryKey: ["admin-event-days", eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("days, schedule")
        .eq("id", eventId)
        .maybeSingle();
      return {
        days: (Array.isArray(data?.days) ? data!.days : []) as unknown as EventDay[],
        schedule: (Array.isArray(data?.schedule) ? data!.schedule : []) as unknown as ScheduleItem[],
      };
    },
    enabled: !!eventId,
  });


  const roomingQ = useQuery({
    queryKey: ["admin-rooming", eventId],
    queryFn: () => fetchRooming(eventId),
    enabled: !!eventId,
  });

  const venues = venuesQ.data ?? [];
  const rows = roomingQ.data ?? [];
  const entriesQ = useQuery({
    queryKey: ["admin-entry-candidates", eventId],
    queryFn: () => loadEntryCandidates(supabase, eventId),
    enabled: !!eventId,
  });
  const candidates: EntryCandidate[] = entriesQ.data ?? [];
  const tentsQ = useQuery({
    queryKey: ["village-tents", eventId],
    queryFn: () => fetchVillageTents(eventId),
    enabled: !!eventId,
  });
  const tents: VillageTent[] = tentsQ.data ?? [];
  const rulesQ = useQuery({
    queryKey: ["village-tent-rules", eventId],
    queryFn: () => fetchTentRules(eventId),
    enabled: !!eventId,
  });
  const tentRules = rulesQ.data ?? [];
  const zones = villageQ.data?.zones ?? [];

  const byVenue = useMemo(() => {
    const map = new Map<string, RoomingRow[]>();
    for (const r of rows) {
      const key = r.venue_id ?? "unassigned";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return map;
  }, [rows]);

  function refreshRooming() {
    void qc.invalidateQueries({ queryKey: ["admin-rooming", eventId] });
    void qc.invalidateQueries({ queryKey: ["admin-venues", eventId] });
  }

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
      .update({
        name: v.name,
        address: v.address,
        notes: v.notes,
        village_spot_id: v.village_spot_id,
        night_start: v.night_start,
        nights: v.nights,
        check_in: v.check_in,
        check_out: v.check_out,
        self_booked: Boolean(v.self_booked),

      })
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
    refreshRooming();
  }

  async function importRows(venueId: string, parsed: ParsedRoomingRow[], replace: boolean) {
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

    const payload = parsed.map((p) => {
      const match = matchEntry(p, candidates);
      const tent = tentForLabel(tents, p.tent_number);
      return {
        event_id: eventId,
        venue_id: venueId,
        entrant_id:
          match.entrantId ?? (p.email ? entrantByEmail.get(p.email.toLowerCase()) ?? null : null),
        event_entrant_id: match.entryId,
        match_source: match.source,
        full_name: p.full_name || p.email || "Unnamed",
        email: p.email || null,
        tent_number: p.tent_number || null,
        room_type: p.room_type || null,
        notes: p.notes || null,
        location_hint: p.location_hint || null,
        village_tent_id: tent?.id ?? null,
        village_zone_id:
          zones.find((z) => labelsMatch(z.name, p.area))?.id ??
          zones.find((z) => labelsMatch(z.name, p.tent_number))?.id ??
          tent?.zone_id ??
          tentRules.find((r) => ruleMatches(r.pattern, p.tent_number))?.zone_id ??
          null,
      };
    });

    const { error } = await supabase.from("event_rooming").insert(payload);
    setBusy(false);
    if (error) setMsg(error.message);
    else {
      const matched = payload.filter((p) => p.event_entrant_id).length;
      const placed = payload.filter((p) => p.village_zone_id).length;
      setMsg(
        `Imported ${payload.length} allocations · ${matched} linked to entries · ${placed} placed on the village map.`,
      );
      refreshRooming();
    }
  }

  /** Re-runs the entry matcher over rows already in the list. */
  async function linkEntries(venueId: string) {
    const venueRows = byVenue.get(venueId) ?? [];
    if (candidates.length === 0) {
      setMsg("No entries loaded for this event yet — sync the entrant list first.");
      return;
    }
    setBusy(true);
    let linked = 0;
    for (const r of venueRows) {
      if (r.event_entrant_id) continue;
      const match = matchEntry({ full_name: r.full_name, email: r.email, notes: r.notes }, candidates);
      if (!match.entryId) continue;
      await supabase
        .from("event_rooming")
        .update({
          event_entrant_id: match.entryId,
          entrant_id: match.entrantId ?? r.entrant_id,
          match_source: match.source,
        })
        .eq("id", r.id);
      linked += 1;
    }
    setBusy(false);
    setMsg(linked ? `Linked ${linked} allocations to their entries.` : "No new entry matches found.");
    refreshRooming();
  }

  async function setRowEntry(id: string, entryId: string | null) {
    const cand = candidates.find((c) => c.id === entryId) ?? null;
    await supabase
      .from("event_rooming")
      .update({
        event_entrant_id: entryId,
        entrant_id: cand?.entrant_id ?? null,
        match_source: entryId ? "manual" : "none",
      })
      .eq("id", id);
    refreshRooming();
  }

  async function setRowTent(id: string, tentId: string | null) {
    const tent = tents.find((t) => t.id === tentId) ?? null;
    await supabase
      .from("event_rooming")
      .update(
        tent?.zone_id
          ? { village_tent_id: tentId, village_zone_id: tent.zone_id }
          : { village_tent_id: tentId },
      )
      .eq("id", id);
    refreshRooming();
  }

  async function setRowZone(id: string, zoneId: string | null) {
    await supabase.from("event_rooming").update({ village_zone_id: zoneId }).eq("id", id);
    refreshRooming();
  }

  /** Places everyone whose tent number matches a drawn area name. */
  async function autoPlace(venueId: string) {
    const venueRows = byVenue.get(venueId) ?? [];
    const updates = venueRows
      .map((r) => {
        const tent = tentForLabel(tents, r.tent_number);
        const zoneId =
          zones.find((z) => labelsMatch(z.name, r.tent_number))?.id ??
          tent?.zone_id ??
          tentRules.find((rule) => ruleMatches(rule.pattern, r.tent_number))?.zone_id ??
          null;
        if (!zoneId && !tent) return null;
        if (zoneId === r.village_zone_id && (tent?.id ?? null) === r.village_tent_id) return null;
        return { id: r.id, zone: zoneId, tent: tent?.id ?? null };
      })
      .filter(Boolean) as { id: string; zone: string | null; tent: string | null }[];
    if (updates.length === 0) {
      setMsg("No tent numbers matched a drawn area name on the village map.");
      return;
    }
    setBusy(true);
    for (const u of updates) {
      await supabase
        .from("event_rooming")
        .update({ village_zone_id: u.zone, village_tent_id: u.tent })
        .eq("id", u.id);
    }
    setBusy(false);
    setMsg(`Placed ${updates.length} people on the village map.`);
    refreshRooming();
  }

  async function saveSheet(venueId: string, url: string, range: string) {
    setBusy(true);
    const { error } = await supabase
      .from("event_venues")
      .update({
        rooming_sheet_url: url.trim() || null,
        rooming_sheet_range: range.trim() || null,
      })
      .eq("id", venueId);
    setBusy(false);
    setMsg(error ? error.message : "Google Sheet link saved.");
    void qc.invalidateQueries({ queryKey: ["admin-venues", eventId] });
  }

  async function syncSheet(venueId: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await syncRoomingSheet({ data: { venueId } });
      setMsg(
        res.ok
          ? `Synced ${res.venue}: ${res.imported} allocations · ${res.matched} matched · ${res.placed} placed on the map.`
          : `Sync failed: ${res.error}`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Sync failed");
    }
    setBusy(false);
    refreshRooming();
  }

  async function deleteRow(id: string) {
    await supabase.from("event_rooming").delete().eq("id", id);
    refreshRooming();
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl font-bold text-ink">Accommodation & rooming lists</h1>
        <p className="text-sm text-ink-soft">
          Add each venue, upload or link its rooming list, then place people on the village map so
          riders and crew can walk straight to the right tent.
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
          <VenueSyncPanel eventId={eventId} />

          <VenueManager
            spots={villageQ.data?.hotspots ?? []}
            venues={venues}
            busy={busy}
            onAdd={addVenue}
            onSave={saveVenue}
            onDelete={deleteVenue}
          />



          <NightCoverage
            days={eventDaysQ.data?.days ?? []}
            schedule={eventDaysQ.data?.schedule ?? []}
            venues={venues}
            rows={rows}
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
                zones={zones}
                rows={byVenue.get(v.id) ?? []}
                busy={busy}
                onImport={(parsed, replace) => void importRows(v.id, parsed, replace)}
                onDeleteRow={(id) => void deleteRow(id)}
                onSetZone={(id, zoneId) => void setRowZone(id, zoneId)}
                onSetTent={(id, tentId) => void setRowTent(id, tentId)}
                onSetEntry={(id, entryId) => void setRowEntry(id, entryId)}
                onLinkEntries={() => void linkEntries(v.id)}
                tents={tents}
                candidates={candidates}
                onAutoPlace={() => void autoPlace(v.id)}
                onSaveSheet={(url, range) => void saveSheet(v.id, url, range)}
                onSyncSheet={() => void syncSheet(v.id)}
              />
            ))
          )}
        </>
      ) : null}
    </div>
  );
}

/** Quick sanity check: which venue hosts each night, and how many beds are placed there. */
function NightCoverage({
  days,
  schedule,
  venues,
  rows,
}: {
  days: EventDay[];
  schedule: ScheduleItem[];
  venues: Venue[];
  rows: RoomingRow[];
}) {
  const nights = eventNights(days, schedule);
  if (nights.length === 0 || venues.length < 2) return null;

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <h2 className="font-display text-sm font-bold text-ink">Night-by-night coverage</h2>
      <p className="mt-1 text-xs text-ink-soft">
        Riders see this timeline on the event page. Set “first night” and “number of nights” on each
        venue above so every night below has a home.
      </p>
      <ul className="mt-3 space-y-1.5">
        {nights.map((n) => {
          const hosts = venues.filter((v) => {
            const start = v.night_start ?? 1;
            const count = v.nights ?? Math.max(1, nights.length - start + 1);
            return n.index >= start && n.index < start + count;
          });
          const placed = hosts.reduce(
            (sum, v) => sum + rows.filter((r) => r.venue_id === v.id).length,
            0,
          );
          return (
            <li
              key={n.index}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-xs"
            >
              <span className="font-bold text-ink">
                Night {n.index}
                {n.dayLabel ? <span className="font-medium text-ink-soft"> · after {n.dayLabel}</span> : null}
              </span>
              {hosts.length === 0 ? (
                <span className="font-bold text-cherry">No venue set</span>
              ) : (
                <span className="text-ink-soft">
                  {hosts.map((v) => v.name).join(" + ")} · {placed} placed
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
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
            <div key={v.id} className="space-y-2 rounded-xl bg-secondary/60 p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_1.5fr_1fr_auto]">

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
            <div className="grid gap-2 md:grid-cols-4">
              <input
                type="number"
                min={1}
                value={cur.night_start ?? ""}
                onChange={(e) =>
                  setEdits((s) => ({
                    ...s,
                    [v.id]: { ...cur, night_start: e.target.value ? Number(e.target.value) : null },
                  }))
                }
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                placeholder="First night (1 = night of day 1)"
                title="Which night of the event riders first sleep here"
              />
              <input
                type="number"
                min={1}
                value={cur.nights ?? ""}
                onChange={(e) =>
                  setEdits((s) => ({
                    ...s,
                    [v.id]: { ...cur, nights: e.target.value ? Number(e.target.value) : null },
                  }))
                }
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                placeholder="Number of nights"
              />
              <input
                value={cur.check_in ?? ""}
                onChange={(e) => setEdits((s) => ({ ...s, [v.id]: { ...cur, check_in: e.target.value || null } }))}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                placeholder="Check-in (e.g. from 14:00)"
              />
              <input
                value={cur.check_out ?? ""}
                onChange={(e) => setEdits((s) => ({ ...s, [v.id]: { ...cur, check_out: e.target.value || null } }))}
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                placeholder="Check-out (e.g. by 09:00)"
              />
            </div>
            <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-ink-soft">
              <input
                type="checkbox"
                checked={Boolean(cur.self_booked)}
                onChange={(e) => setEdits((s) => ({ ...s, [v.id]: { ...cur, self_booked: e.target.checked } }))}
              />
              Riders book this night themselves (pre-event / not included in the entry)
            </label>

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

function SheetLink({
  venue,
  busy,
  onSave,
  onSync,
}: {
  venue: Venue;
  busy: boolean;
  onSave: (url: string, range: string) => void;
  onSync: () => void;
}) {
  const [url, setUrl] = useState(venue.rooming_sheet_url ?? "");
  const [range, setRange] = useState(venue.rooming_sheet_range ?? "");

  return (
    <div className="mt-3 rounded-xl bg-secondary/60 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
        <Link2 className="h-3.5 w-3.5" /> Live Google Sheet
      </p>
      <div className="mt-2 grid gap-2 md:grid-cols-[2fr_1fr_auto_auto]">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/…"
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
        />
        <input
          value={range}
          onChange={(e) => setRange(e.target.value)}
          placeholder="Sheet1!A1:Z2000 (optional)"
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => onSave(url, range)}
          className="rounded-lg bg-ink px-2.5 py-1.5 text-xs font-bold text-white"
        >
          Save link
        </button>
        <button
          type="button"
          disabled={busy || !venue.rooming_sheet_url}
          onClick={onSync}
          className="inline-flex items-center gap-1 rounded-lg bg-cherry px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Sync now
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-ink-soft">
        The sheet is re-read automatically every hour and replaces this venue's list — headings:
        full_name, email, tent_number, room_type, notes, location_hint, area.
        {venue.rooming_sheet_synced_at
          ? ` Last sync ${new Date(venue.rooming_sheet_synced_at).toLocaleString("en-ZA")}${
              venue.rooming_sheet_rows != null ? ` · ${venue.rooming_sheet_rows} rows` : ""
            }.`
          : ""}
      </p>
      {venue.rooming_sheet_error ? (
        <p className="mt-1 text-[11px] font-semibold text-cherry">{venue.rooming_sheet_error}</p>
      ) : null}
    </div>
  );
}

function VenueRooming({
  venue,
  zones,
  rows,
  busy,
  onImport,
  onDeleteRow,
  onSetZone,
  onSetTent,
  onSetEntry,
  onLinkEntries,
  onAutoPlace,
  onSaveSheet,
  onSyncSheet,
  tents,
  candidates,
}: {
  venue: Venue;
  zones: VillageZone[];
  rows: RoomingRow[];
  busy: boolean;
  tents: VillageTent[];
  candidates: EntryCandidate[];
  onImport: (parsed: ParsedRoomingRow[], replace: boolean) => void;
  onDeleteRow: (id: string) => void;
  onSetZone: (id: string, zoneId: string | null) => void;
  onSetTent: (id: string, tentId: string | null) => void;
  onSetEntry: (id: string, entryId: string | null) => void;
  onLinkEntries: () => void;
  onAutoPlace: () => void;
  onSaveSheet: (url: string, range: string) => void;
  onSyncSheet: () => void;
}) {
  const [text, setText] = useState("");
  const [sheetRows, setSheetRows] = useState<ParsedRoomingRow[] | null>(null);
  const [replace, setReplace] = useState(true);
  const parsed = useMemo(
    () => sheetRows ?? (text.trim() ? parseRoomingCsv(text) : []),
    [text, sheetRows],
  );
  const placed = rows.filter((r) => r.village_zone_id || r.village_tent_id).length;
  const linked = rows.filter((r) => r.event_entrant_id).length;
  const unmatched = rows.filter((r) => !r.event_entrant_id);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const visibleRows = showUnmatched ? unmatched : rows;

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <h2 className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-ink">
        <BedDouble className="h-4 w-4 text-cherry" /> {venue.name}
        <span className="text-xs font-semibold text-ink-soft">
          · {rows.length} allocated · {linked} linked to entries · {placed} on the map
        </span>
      </h2>

      <SheetLink venue={venue} busy={busy} onSave={onSaveSheet} onSync={onSyncSheet} />

      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-ink">
            <FileUp className="h-3.5 w-3.5" /> Upload CSV or Excel
            <input
              type="file"
              accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (/\.xlsx?$/i.test(file.name)) {
                  setSheetRows(await parseRoomingWorkbook(file));
                  setText("");
                } else {
                  setSheetRows(null);
                  setText(await file.text());
                }
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            disabled={busy || zones.length === 0}
            onClick={onAutoPlace}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
            title="Match tent numbers to drawn village-map areas"
          >
            <Sparkles className="h-3.5 w-3.5" /> Auto-place on map
          </button>
          <button
            type="button"
            disabled={busy || rows.length === 0}
            onClick={onLinkEntries}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-ink disabled:opacity-50"
            title="Match these people to their real event entries"
          >
            <Link2 className="h-3.5 w-3.5" /> Link to entries
          </button>
          {unmatched.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowUnmatched((v) => !v)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                showUnmatched ? "bg-cherry text-white" : "border border-border bg-background text-ink"
              }`}
            >
              {unmatched.length} unmatched
            </button>
          ) : null}
          <label className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
            Replace this venue's existing list
          </label>
        </div>

        {sheetRows ? (
          <p className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-ink">
            Excel file loaded — {sheetRows.length} rows ready to import.
          </p>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder={SAMPLE}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px]"
          />
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy || parsed.length === 0}
            onClick={() => {
              onImport(parsed, replace);
              setText("");
              setSheetRows(null);
            }}
            className="rounded-lg bg-cherry px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            Import {parsed.length || ""} rows
          </button>
          <span className="text-[11px] text-ink-soft">
            Columns: full_name, email, tent_number, room_type, notes, location_hint, area
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
                <th>Map area</th>
                <th>Tent pin</th>
                <th>Entry</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-1.5 font-semibold text-ink">{r.full_name}</td>
                  <td className="text-ink-soft">{r.email ?? "—"}</td>
                  <td className="font-bold text-ink">{r.tent_number ?? "—"}</td>
                  <td className="text-ink-soft">{r.room_type ?? "—"}</td>
                  <td>
                    <select
                      value={r.village_zone_id ?? ""}
                      onChange={(e) => onSetZone(r.id, e.target.value || null)}
                      className="max-w-[150px] rounded border border-border bg-background px-1.5 py-1 text-[11px]"
                    >
                      <option value="">Not placed</option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name || "Area"}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={r.village_tent_id ?? ""}
                      onChange={(e) => onSetTent(r.id, e.target.value || null)}
                      className="max-w-[120px] rounded border border-border bg-background px-1.5 py-1 text-[11px]"
                    >
                      <option value="">No pin</option>
                      {tents.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={r.event_entrant_id ?? ""}
                      onChange={(e) => onSetEntry(r.id, e.target.value || null)}
                      className={`max-w-[180px] rounded border border-border bg-background px-1.5 py-1 text-[11px] ${
                        r.event_entrant_id ? "text-emerald-600" : "text-ink-soft"
                      }`}
                    >
                      <option value="">Not linked</option>
                      {candidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name}
                          {c.bib_number ? ` · ${c.bib_number}` : ""}
                        </option>
                      ))}
                    </select>
                    {r.match_source && r.match_source !== "none" ? (
                      <span className="ml-1 text-[10px] uppercase text-ink-soft">{r.match_source}</span>
                    ) : null}
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
