import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, MapPin, Search, Users, Copy, Check } from "lucide-react";
import { useIsCrew } from "@/lib/auth";
import {
  fetchCrewEvents,
  fetchCrewRooming,
  matchesSearch,
  normaliseTent,
  roomMates,
  whereIsRoom,
  type CrewRoomingRow,
} from "@/lib/crew";
import { VillageMapView } from "@/components/village-map-view";

export const Route = createFileRoute("/crew")({
  head: () => ({
    meta: [
      { title: "Crew rooming finder · Red Cherry Events" },
      {
        name: "description",
        content: "Event crew tool: find any rider's tent or room, see who they share with, and locate it on the village map.",
      },
      { property: "og:title", content: "Crew rooming finder · Red Cherry Events" },
      {
        property: "og:description",
        content: "Search riders by name to see their tent, room mates and exactly where to find them on site.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CrewPage,
});

function CrewPage() {
  const { isCrew, loading, user } = useIsCrew();
  const [eventId, setEventId] = useState("");
  const [term, setTerm] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusSpot, setFocusSpot] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const eventsQ = useQuery({ queryKey: ["crew-events"], queryFn: fetchCrewEvents, enabled: isCrew });
  const roomingQ = useQuery({
    queryKey: ["crew-rooming", eventId],
    queryFn: () => fetchCrewRooming(eventId),
    enabled: isCrew && !!eventId,
  });

  const events = eventsQ.data ?? [];

  useEffect(() => {
    if (!eventId && events.length) {
      const now = Date.now();
      const next = events.find((e) => new Date(e.event_date).getTime() >= now) ?? events[events.length - 1];
      setEventId(next.id);
    }
  }, [events, eventId]);

  const rows = roomingQ.data ?? [];
  const results = useMemo(() => rows.filter((r) => matchesSearch(r, term)), [rows, term]);

  const tents = useMemo(() => {
    const map = new Map<string, CrewRoomingRow[]>();
    for (const r of rows) {
      const key = normaliseTent(r.tent_number) || "Unallocated";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [rows]);

  function showOnMap(row: CrewRoomingRow) {
    setFocusSpot(row.venue?.village_spot_id ?? null);
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function copyWhere(row: CrewRoomingRow) {
    try {
      await navigator.clipboard.writeText(`${row.full_name} — ${whereIsRoom(row)}`);
      setCopied(row.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-ink-soft">Checking your crew access…</div>;
  }
  if (!user) return <Navigate to="/auth" search={{ next: "/crew" }} />;
  if (!isCrew) {
    return (
      <div className="space-y-3 p-6 text-center">
          <h1 className="font-display text-xl font-bold text-ink">Crew access only</h1>
          <p className="text-sm text-ink-soft">
            This area is for Red Cherry event crew. Ask an admin to add crew access to your account.
          </p>
          <Link to="/" className="inline-flex rounded-full bg-cherry px-4 py-2 text-xs font-bold text-white">
            Back to the app
          </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pb-8 pt-5">
        <header>
          <p className="text-[11px] font-bold uppercase tracking-widest text-cherry">Crew</p>
          <h1 className="font-display text-2xl font-bold text-ink">Who's in which room</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Search a rider by name to see their tent or room, who they share with, and exactly where to send them.
          </p>
        </header>

        <div className="rounded-2xl bg-card p-3 ring-1 ring-border">
          <label className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">Event</label>
          <select
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              setOpenId(null);
              setFocusSpot(null);
            }}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select an event…</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>

          <div className="mt-3 flex items-center gap-2 rounded-xl bg-secondary/70 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-ink-soft" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search rider name, tent number or email"
              className="w-full bg-transparent text-sm outline-none"
              autoComplete="off"
            />
          </div>
          <p className="mt-2 text-[11px] text-ink-soft">
            {roomingQ.isLoading
              ? "Loading rooming list…"
              : `${rows.length} allocations · ${tents.length} tents/rooms`}
          </p>
        </div>

        {term.trim() ? (
          <section className="space-y-2">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">
              {results.length} match{results.length === 1 ? "" : "es"}
            </h2>
            {results.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-ink-soft">
                No one by that name on this event's rooming list.
              </p>
            ) : (
              results.map((r) => {
                const mates = roomMates(rows, r);
                const open = openId === r.id;
                return (
                  <article key={r.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-base font-bold text-ink">{r.full_name}</p>
                        <p className="mt-0.5 text-xs text-ink-soft">{whereIsRoom(r) || "No allocation captured"}</p>
                      </div>
                      <span className="shrink-0 rounded-xl bg-cherry px-3 py-2 text-center font-display text-lg font-bold leading-none text-white">
                        {r.tent_number || "—"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => showOnMap(r)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white"
                      >
                        <MapPin className="h-3.5 w-3.5" /> Find on village map
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : r.id)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold text-ink-soft"
                      >
                        <Users className="h-3.5 w-3.5" /> {mates.length} sharing
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyWhere(r)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold text-ink-soft"
                      >
                        {copied === r.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === r.id ? "Copied" : "Copy details"}
                      </button>
                    </div>

                    {open ? (
                      <ul className="mt-3 space-y-1 rounded-xl bg-secondary/60 p-3 text-sm">
                        {mates.length === 0 ? (
                          <li className="text-ink-soft">Sole occupant of this tent/room.</li>
                        ) : (
                          mates.map((m) => (
                            <li key={m.id} className="flex items-center justify-between gap-2">
                              <span className="truncate font-semibold text-ink">{m.full_name}</span>
                              <span className="shrink-0 text-xs text-ink-soft">{m.room_type ?? ""}</span>
                            </li>
                          ))
                        )}
                        {r.notes ? <li className="pt-1 text-xs text-ink-soft">Note: {r.notes}</li> : null}
                      </ul>
                    ) : null}
                  </article>
                );
              })
            )}
          </section>
        ) : (
          <section className="space-y-2">
            <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
              <BedDouble className="h-3.5 w-3.5" /> All tents & rooms
            </h2>
            {tents.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-ink-soft">
                No rooming list uploaded for this event yet.
              </p>
            ) : (
              tents.map(([tent, people]) => (
                <div key={tent} className="rounded-2xl bg-card p-3 ring-1 ring-border">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-sm font-bold text-ink">
                      {tent === "Unallocated" ? "Unallocated" : `Tent / room ${tent}`}
                    </p>
                    <button
                      type="button"
                      onClick={() => showOnMap(people[0])}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-cherry"
                    >
                      <MapPin className="h-3 w-3" /> Map
                    </button>
                  </div>
                  <ul className="mt-1.5 space-y-0.5">
                    {people.map((p) => (
                      <li key={p.id} className="truncate text-sm text-ink-soft">
                        {p.full_name}
                        {p.venue?.name ? ` · ${p.venue.name}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        )}

        <section ref={mapRef} className="space-y-2 pt-2">
          <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
            <MapPin className="h-3.5 w-3.5" /> Village map
          </h2>
          {eventId ? <VillageMapView eventId={eventId} focusSpotId={focusSpot} /> : null}
        </section>
    </div>
  );
}
