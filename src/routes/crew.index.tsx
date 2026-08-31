// Crew home: pick the event you're working, see the day at a glance and jump
// straight into the on-site tools (rider lookup, rooming, village map).
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BedDouble, Boxes, CalendarDays, ClipboardList, GraduationCap, HardHat, Map as MapIcon, MapPin, Search, Siren, Users } from "lucide-react";
import { useIsCrew } from "@/lib/auth";
import { fetchAllCrewEvents, fetchCrewEvents, fetchCrewRooming, normaliseTent } from "@/lib/crew";
import { buildCrewTimeline, groupScheduleByDay, pickCurrentDay } from "@/lib/crew-plan";
import { useCrewEvent } from "@/lib/crew-event";
import { supabase } from "@/integrations/supabase/client";
import type { EventDay, ScheduleItem } from "@/lib/mock-data";


export const Route = createFileRoute("/crew/")({
  head: () => ({
    meta: [
      { title: "Crew dashboard · Red Cherry Events" },
      {
        name: "description",
        content:
          "On-site crew dashboard: today's running order, rider and rooming lookups, and the race village map for the event you're working.",
      },
      { property: "og:title", content: "Crew dashboard · Red Cherry Events" },
      {
        property: "og:description",
        content: "Everything Red Cherry event crew need on site, in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CrewDashboard,
});

function CrewDashboard() {
  const { isCrew, loading, user } = useIsCrew();

  const [showPast, setShowPast] = useState(false);
  const eventsQ = useQuery({
    queryKey: ["crew-events", showPast ? "all" : "visible"],
    queryFn: showPast ? fetchAllCrewEvents : fetchCrewEvents,
    enabled: isCrew,
  });
  const events = eventsQ.data ?? [];
  const [eventId, pickEvent] = useCrewEvent(events);


  const detailQ = useQuery({
    queryKey: ["crew-event-detail", eventId],
    enabled: isCrew && !!eventId,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, event_date, location, schedule, days")
        .eq("id", eventId)
        .maybeSingle();
      return data;
    },
  });

  const roomingQ = useQuery({
    queryKey: ["crew-rooming", eventId],
    queryFn: () => fetchCrewRooming(eventId),
    enabled: isCrew && !!eventId,
  });

  const entrantsQ = useQuery({
    queryKey: ["crew-entrant-count", eventId],
    enabled: isCrew && !!eventId,
    queryFn: async () => {
      const { count } = await supabase
        .from("event_entrants")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId);
      return count ?? 0;
    },
  });

  const rooming = roomingQ.data ?? [];
  const tents = useMemo(
    () => new Set(rooming.map((r) => normaliseTent(r.tent_number)).filter(Boolean)).size,
    [rooming],
  );
  const placed = useMemo(() => rooming.filter((r) => r.village_zone_id).length, [rooming]);

  const event = detailQ.data;
  const dayGroups = useMemo(
    () =>
      groupScheduleByDay(
        (Array.isArray(event?.schedule) ? event?.schedule : []) as ScheduleItem[],
        (Array.isArray(event?.days) ? event?.days : []) as EventDay[],
      ),
    [event],
  );
  const [dayId, setDayId] = useState("");
  useEffect(() => {
    setDayId(pickCurrentDay(dayGroups));
  }, [dayGroups]);
  const activeDay = dayGroups.find((d) => d.id === dayId) ?? dayGroups[0];
  const crewTasks = useMemo(() => buildCrewTimeline(activeDay), [activeDay]);
  const [view, setView] = useState<"crew" | "riders">("crew");


  if (loading) return <div className="p-6 text-sm text-ink-soft">Checking your crew access…</div>;
  if (!user) return <Navigate to="/crew/login" />;
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
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 pb-10 pt-5">
      <header>
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-cherry">
          <HardHat className="h-3.5 w-3.5" /> Crew
        </p>
        <h1 className="font-display text-2xl font-bold text-ink">Crew dashboard</h1>
        <p className="mt-1 text-sm text-ink-soft">Pick the event you're working and jump into the on-site tools.</p>
      </header>

      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-widest text-ink-soft">Event</span>
        <select
          value={eventId}
          onChange={(e) => pickEvent(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold text-ink outline-none focus:border-cherry"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} · {new Date(e.event_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}
            </option>
          ))}
        </select>
        <label className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-ink-soft">
          <input
            type="checkbox"
            checked={showPast}
            onChange={(e) => setShowPast(e.target.checked)}
            className="h-3.5 w-3.5 accent-cherry"
          />
          Show past events
        </label>
      </label>

      <div className="grid grid-cols-3 gap-2">
        <Stat icon={<Users className="h-4 w-4" />} label="Entrants" value={entrantsQ.data ?? 0} />
        <Stat icon={<BedDouble className="h-4 w-4" />} label="Tents / rooms" value={tents} />
        <Stat icon={<MapIcon className="h-4 w-4" />} label="On the map" value={`${placed}/${rooming.length}`} />
      </div>

      <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
        <h2 className="flex items-center gap-1.5 font-display text-sm font-bold text-ink">
          <CalendarDays className="h-4 w-4 text-cherry" /> Crew plan
        </h2>

        {dayGroups.length > 1 ? (
          <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {dayGroups.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDayId(d.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                  d.id === activeDay?.id
                    ? "bg-cherry text-white"
                    : "bg-surface text-ink-soft ring-1 ring-border"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        ) : null}

        {activeDay ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-surface p-1 ring-1 ring-border">
              {(["crew", "riders"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-full py-1.5 text-[11px] font-bold transition ${
                    view === v ? "bg-card text-ink shadow-sm" : "text-ink-soft"
                  }`}
                >
                  {v === "crew" ? "Crew timeline" : "Rider running order"}
                </button>
              ))}
            </div>

            {view === "riders" ? (
              <ul className="mt-2 divide-y divide-border">
                {activeDay.items.map((it, i) => (
                  <li key={i} className="flex gap-3 py-2">
                    <span className="w-14 shrink-0 font-display text-sm font-bold text-cherry">{it.time}</span>
                    <span className="text-sm text-ink">
                      {it.label}
                      {it.details ? <span className="block text-[11px] text-ink-soft">{it.details}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <ol className="mt-2 divide-y divide-border">
                {crewTasks.map((t, i) => (
                  <li key={i} className="flex gap-3 py-2.5">
                    <span className="w-14 shrink-0 font-display text-sm font-bold text-cherry">{t.time}</span>
                    <span className="min-w-0 text-sm text-ink">
                      <span className="font-semibold">{t.label}</span>
                      <span className="ml-1.5 rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft ring-1 ring-border">
                        {t.role}
                      </span>
                      {t.detail ? <span className="block text-[11px] text-ink-soft">{t.detail}</span> : null}
                      {t.anchor ? (
                        <span className="block text-[11px] text-ink-soft">For: {t.anchor}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-2 text-[11px] text-ink-soft">
              Crew times are worked back from the published running order and update automatically whenever the
              schedule changes.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">No running order loaded for this event yet.</p>
        )}
      </section>


      <section className="grid gap-2 sm:grid-cols-2">
        <Tile
          to="/crew/learn"
          icon={<GraduationCap className="h-5 w-5" />}
          title="Learn"
          body="New here? Train on the business, this event and your department — built from our live data."
        />
        <Tile
          to="/crew/run-sheet"
          icon={<ClipboardList className="h-5 w-5" />}
          title="Run sheet"
          body="Your department's instructions for each day, packing lists and onboarding."
        />
        <Tile

          to="/crew/rooming"
          icon={<Search className="h-5 w-5" />}
          title="Find a rider"
          body="Search by name to see their tent, room mates and exactly where to send them."
        />
        <Tile
          to="/crew/rooming"
          icon={<BedDouble className="h-5 w-5" />}
          title="Rooming lists"
          body="Every tent and room for the event, grouped and searchable."
        />
        <Tile
          to="/crew/inventory"
          icon={<Boxes className="h-5 w-5" />}
          title="Inventory management"
          body="The full event load-out: what to pack, who is driving it, and packed / on site / setup / returned ticks."
        />
        <Tile
          to="/crew/build"
          icon={<MapPin className="h-5 w-5" />}
          title="Field build map"
          body="Generators, water, fencing, gazebos, flags and signage — where each goes, with quantities."
        />
        <Tile
          to="/crew/tracking"
          icon={<Siren className="h-5 w-5" />}
          title="Race control"
          body="Live rider positions and SOS alerts — crew only, riders never see these."
        />

        {event ? (
          <Tile
            to="/spectate/$eventId"
            params={{ eventId: event.id }}
            icon={<ClipboardList className="h-5 w-5" />}
            title="Start lists"
            body="Batches, categories and who is riding what."
          />
        ) : null}
        {event ? (
          <Tile
            to="/my-events/$eventId"
            params={{ eventId: event.id }}
            icon={<MapIcon className="h-5 w-5" />}
            title="Event page & village map"
            body="Routes, schedule and the race village layout riders are seeing."
          />
        ) : null}
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center shadow-sm ring-1 ring-border">
      <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-cherry/10 text-cherry">
        {icon}
      </span>
      <p className="mt-1 font-display text-lg font-bold text-ink">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">{label}</p>
    </div>
  );
}

function Tile({
  to,
  params,
  icon,
  title,
  body,
}: {
  to: string;
  params?: Record<string, string>;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      className="flex gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border transition active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cherry/10 text-cherry">
        {icon}
      </span>
      <span>
        <span className="block font-display text-sm font-bold text-ink">{title}</span>
        <span className="block text-[11px] text-ink-soft">{body}</span>
      </span>
    </Link>
  );
}
