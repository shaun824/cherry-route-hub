import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Car,
  Coffee,
  ExternalLink,
  Info,
  Lock,
  MapPin,

  Search,
  Toilet,
  Trophy,
  Users,
} from "lucide-react";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import { formatDate, formatTime } from "@/lib/mock-data";
import {
  getEventRiders,
  getEventResults,
  type TrackedRider,
  type RosterPayload,
  type EventResultsPayload,
} from "@/lib/results.functions";
import { useSession } from "@/lib/auth";

import { brandHeader } from "@/lib/event-brand";
import { buildMapEmbedSrc, buildMapLink, resolveVenuePoint } from "@/lib/map-embed";
import { VenueMiniMap } from "@/components/venue-mini-map";
import { VillageMapView } from "@/components/village-map-view";
import { fetchVillageMap } from "@/lib/village-map";

import { fetchEventInfo } from "@/lib/event-info";
import { groupRidersByClass } from "@/lib/rider-classes";
import { eventPromosFor } from "@/lib/event-promos";
import { PromoCodeCard } from "@/components/promo-code-card";


export const Route = createFileRoute("/spectate/$eventId")({
  head: ({ params }) => ({
    meta: [
      { title: `Track riders — Red Cherry Events` },
      {
        name: "description",
        content: `Track riders at this Red Cherry event: rider list with bib numbers, batches, results and venue info.`,
      },
      { property: "og:title", content: "Track riders — Red Cherry Events" },
      {
        property: "og:description",
        content: `Rider list with bib numbers, batches, results and spectator venue info.`,
      },
    ],
    ...({ _: params } as Record<string, unknown>),
  }),
  component: SpectatorEventPage,
});

type Tab = "info" | "riders" | "results";
type GroupBy = "class" | "start" | "bib" | "category" | "name";

function riderResultUrl(template: string | null, bib: string | null) {
  if (!template || !bib) return null;
  return template.includes("{bib}") ? template.replace(/\{bib\}/g, encodeURIComponent(bib)) : template;
}

function SpectatorEventPage() {
  useHydratedStore();
  const { eventId } = Route.useParams();
  const event = useAdminStore((s) => s.events.find((e) => e.id === eventId));
  const [tab, setTab] = useState<Tab>("riders");
  const [categoryFilter, setCategoryFilter] = useState<string>("__all");
  const [groupBy, setGroupBy] = useState<GroupBy>("class");
  const [search, setSearch] = useState("");

  const { user } = useSession();
  const fetchRiders = useServerFn(getEventRiders);
  const ridersQ = useQuery<RosterPayload>({
    queryKey: ["event-riders", eventId, user?.id ?? "guest"],
    queryFn: () => fetchRiders({ data: { eventId } }),
    staleTime: 60_000,
  });
  const rosterStatus = ridersQ.data?.status ?? "ok";
  const rosterOpensAt = ridersQ.data?.opens_at ?? null;
  const roster: TrackedRider[] = ridersQ.data?.riders ?? [];


  const fetchResults = useServerFn(getEventResults);
  const resultsQ = useQuery<EventResultsPayload>({
    queryKey: ["event-results", eventId],
    queryFn: () => fetchResults({ data: { eventId } }),
    staleTime: 60_000,
  });
  const results = resultsQ.data;

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of roster) if (r.category) set.add(r.category);
    return Array.from(set).sort();
  }, [roster]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roster.filter((r) => {
      if (categoryFilter !== "__all" && (r.category ?? "") !== categoryFilter) return false;
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) || (r.bib_number ?? "").toLowerCase().includes(q)
      );
    });
  }, [roster, categoryFilter, search]);

  const infoQ = useQuery({
    queryKey: ["event-info", eventId],
    queryFn: () => fetchEventInfo(eventId),
    staleTime: 300_000,
  });
  const info = infoQ.data ?? null;

  const spectatorSchedule = useMemo(() => {
    const items = event?.schedule ?? [];
    const dayLabel = new Map((event?.days ?? []).map((d) => [d.id, d.label || d.date]));
    const keep =
      /(start|finish|prize|podium|award|briefing|registration|batch|expo|hand.?out|line.?up|ceremon)/i;
    return items
      .filter((s) => keep.test(`${s.label} ${s.details ?? ""}`))
      .slice(0, 8)
      .map((s) => ({
        time: s.time,
        title: s.label,
        day: s.dayId ? dayLabel.get(s.dayId) ?? null : null,
      }));
  }, [event?.schedule, event?.days]);

  const spectatorFaqs = useMemo(() => {
    const faqs = info?.faqs ?? [];
    const relevant =
      /(spectat|park|watch|support|family|kids|dog|drone|food|bar|access|drive|shuttle|entry to|venue)/i;
    const picked = faqs.filter((f) => relevant.test(`${f.q} ${f.a}`));
    return (picked.length ? picked : faqs).slice(0, 5);
  }, [info?.faqs]);

  const batches = event?.batches ?? [];
  const promos = useMemo(() => eventPromosFor(event?.name), [event?.name]);

  const batchLookup = useMemo(() => {
    const m = new Map<string, { name: string; startTime: string }>();
    for (const b of batches) m.set(b.name, { name: b.name, startTime: b.startTime });
    return m;
  }, [batches]);

  const startGroups = useMemo(() => {
    if (groupBy === "class") {
      const { classes, dayRiders } = groupRidersByClass(filtered);
      const sortRows = (rows: TrackedRider[]) =>
        [...rows].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
      return [
        ...classes.map((g) => ({ key: g.key, label: g.label, startTime: "", rows: sortRows(g.rows) })),
        ...dayRiders.map((g) => ({
          key: g.key,
          label: `Day riders · ${g.label}`,
          startTime: "",
          rows: sortRows(g.rows),
        })),
      ];
    }

    const groups = new Map<
      string,
      { key: string; label: string; startTime: string; rows: TrackedRider[] }
    >();
    const push = (key: string, label: string, startTime: string, r: TrackedRider) => {
      if (!groups.has(key)) groups.set(key, { key, label, startTime, rows: [] });
      groups.get(key)!.rows.push(r);
    };


    for (const r of filtered) {
      if (groupBy === "name") {
        push("__all", "All riders", "", r);
      } else if (groupBy === "bib") {
        push("__all", "By race number", "", r);
      } else if (groupBy === "category") {
        push(r.category ?? "__none", r.category ?? "No category", "", r);
      } else {
        const meta = r.batch ? batchLookup.get(r.batch) : undefined;
        push(r.batch ?? "__unassigned", r.batch ?? "All riders", meta?.startTime ?? "", r);
      }
    }

    const bibValue = (r: TrackedRider) => {
      const n = Number(String(r.bib_number ?? "").replace(/\D+/g, ""));
      return Number.isFinite(n) && String(r.bib_number ?? "").trim() ? n : Number.MAX_SAFE_INTEGER;
    };
    for (const g of groups.values()) {
      g.rows.sort((a, b) =>
        groupBy === "bib"
          ? bibValue(a) - bibValue(b) || (a.full_name || "").localeCompare(b.full_name || "")
          : (a.full_name || "").localeCompare(b.full_name || ""),
      );
    }
    return Array.from(groups.values()).sort((a, b) => {
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      if (a.startTime) return -1;
      if (b.startTime) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [filtered, batchLookup, groupBy]);

  const [activeSet, setActiveSet] = useState<string | null>(null);
  const currentSetId = activeSet ?? results?.sets[0]?.id ?? null;
  const resultRows = useMemo(() => {
    if (!results || !currentSetId) return [];
    const q = search.trim().toLowerCase();
    return results.rows
      .filter((r) => r.result_set_id === currentSetId)
      .filter((r) => categoryFilter === "__all" || (r.category ?? "") === categoryFilter)
      .filter(
        (r) =>
          !q || r.full_name.toLowerCase().includes(q) || (r.bib_number ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999));
  }, [results, currentSetId, categoryFilter, search]);

  const resultGroups = useMemo(() => {
    const withGender = resultRows.map((r) => {
      const extras = (r.extras ?? {}) as Record<string, string>;
      const key = Object.keys(extras).find((k) => /^(gender|sex)$/i.test(k));
      return { ...r, gender: key ? extras[key] : null };
    });
    const { classes, dayRiders } = groupRidersByClass(withGender);
    return [
      ...classes,
      ...dayRiders.map((g) => ({ ...g, label: `Day riders · ${g.label}` })),
    ];
  }, [resultRows]);

  if (!event) {
    return (
      <div className="p-8 text-center">
        <p className="text-ink">Event not available.</p>
        <Link to="/spectate" className="mt-4 inline-block font-semibold text-cherry">
          Back to Track riders
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <div
        className={`relative overflow-hidden ${brandHeader(event.heroColor).className} px-5 pb-6 text-white`}
        style={{ ...brandHeader(event.heroColor).style, paddingTop: "calc(env(safe-area-inset-top) + 3.5rem)" }}
      >
        {event.coverUrl ? (
          <>
            <img src={event.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          </>
        ) : null}
        <Link
          to="/spectate"
          aria-label="Back"
          className="absolute left-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur"
          style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="relative flex items-center gap-3">
          {event.logoUrl ? (
            <img
              src={event.logoUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl bg-white/10 object-contain p-1.5 ring-1 ring-white/25 backdrop-blur"
            />
          ) : null}
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-widest opacity-85">
              Track riders · {event.discipline}
            </span>
            <h1 className="mt-1 font-display text-2xl font-bold leading-tight">{event.name}</h1>
          </div>
        </div>
        <div className="relative mt-4 space-y-1 text-sm">
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 opacity-80" />
            {formatDate(event.date)} · {formatTime(event.date)}
          </p>
          {event.location ? (
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 opacity-80" /> {event.location}
            </p>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-20 -mt-3 px-5">
        <div className="flex gap-1 rounded-2xl bg-card p-1 shadow-lg ring-1 ring-border">
          {([
            { id: "riders", label: "Riders", icon: Users },
            { id: "results", label: "Results", icon: Trophy },
            { id: "info", label: "Venue", icon: Info },
          ] as { id: Tab; label: string; icon: typeof Info }[]).map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors ${
                  active ? "bg-cherry text-white shadow-sm" : "text-ink-soft hover:text-ink"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "info" ? (
        <div className="px-5 pt-5 pb-8 space-y-4 animate-fade-in">
          {/* Location + navigate */}
          <section>
            <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
              Getting there
            </h2>
            {(() => {
              const address = info?.venue_address || event.location || null;
              const mapUrl = event.mapQuery || info?.map_embed_url || null;
              const mapLink = buildMapLink({ mapUrl, address });
              const embedSrc = buildMapEmbedSrc({ mapUrl, address });
              const point =
                info?.venue_lat != null && info?.venue_lng != null
                  ? { lat: Number(info.venue_lat), lng: Number(info.venue_lng) }
                  : resolveVenuePoint({ mapUrl });
              if (!mapLink || (!embedSrc && !point))
                return <p className="mt-3 text-xs text-ink-soft">No venue set yet.</p>;
              return (
                <a
                  href={mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block overflow-hidden rounded-2xl ring-1 ring-border"
                >
                  {point ? (
                    <div className="pointer-events-none h-44 w-full">
                      <VenueMiniMap lat={point.lat} lng={point.lng} height="176px" />
                    </div>
                  ) : (
                    <iframe
                      title="Event venue map"
                      src={embedSrc!}
                      className="pointer-events-none h-44 w-full"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  )}
                  <div className="flex items-center justify-between gap-3 bg-card px-3 py-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                      {address || "Event venue"}
                    </span>
                    <span className="shrink-0 font-semibold text-cherry">Navigate ↗</span>
                  </div>
                </a>
              );
            })()}
          </section>

          {/* Race village map */}
          {villageQ.data ? (
            <section>
              <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
                Race village
              </h2>
              <div className="mt-3">
                <VillageMapView eventId={eventId} />
              </div>
            </section>
          ) : null}



          {/* Spectator essentials */}
          <FactCard icon={Car} title="Parking">
            {event.spectatorParking ??
              info?.parking_notes ??
              "Parking details will be shared closer to race day."}
          </FactCard>

          <FactCard icon={Coffee} title="Food & refreshments">
            {event.spectatorFood ?? "Food trucks and refreshments are typically available at the venue."}
          </FactCard>

          <FactCard icon={Toilet} title="Toilets">
            {event.hasToilets !== false
              ? "Portable / venue toilets are available on-site."
              : "No toilets on site — please plan accordingly."}
          </FactCard>

          {event.spectatorNotes ? (
            <FactCard icon={Info} title="Good to know">
              {event.spectatorNotes}
            </FactCard>
          ) : null}

          {/* Route / what to expect out there */}
          {info?.route_description || info?.distance_km || info?.elevation_m ? (
            <section>
              <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
                The racing
              </h2>
              <div className="mt-3 rounded-2xl bg-card p-4 ring-1 ring-border">
                {info?.distance_km || info?.elevation_m ? (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {info?.distance_km ? (
                      <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-bold text-cherry-deep">
                        {Math.round(Number(info.distance_km))} km
                      </span>
                    ) : null}
                    {info?.elevation_m ? (
                      <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-bold text-cherry-deep">
                        {Math.round(Number(info.elevation_m))} m climbing
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {info?.route_description ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                    {info.route_description.length > 320
                      ? `${info.route_description.slice(0, 320).trim()}…`
                      : info.route_description}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* Batch start times */}
          {batches.length > 0 ? (
            <section>
              <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
                Start times
              </h2>
              <ul className="mt-3 space-y-2">
                {[...batches]
                  .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""))
                  .map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-border"
                    >
                      <span className="grid h-9 w-14 place-items-center rounded-md bg-accent font-mono text-xs font-bold text-cherry-deep">
                        {b.startTime || "—"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">{b.name}</p>
                        {b.description ? (
                          <p className="text-[11px] text-ink-soft">{b.description}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}

          {/* Spectator-relevant schedule highlights */}
          {spectatorSchedule.length > 0 ? (
            <section>
              <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
                Key moments to catch
              </h2>
              <ul className="mt-3 space-y-2">
                {spectatorSchedule.map((s, i) => (
                  <li
                    key={`${s.time}-${i}`}
                    className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-border"
                  >
                    <span className="grid h-9 w-14 shrink-0 place-items-center rounded-md bg-accent font-mono text-xs font-bold text-cherry-deep">
                      {s.time || "—"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{s.title}</p>
                      {s.day ? <p className="text-[11px] text-ink-soft">{s.day}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Emergency contacts */}
          {info?.emergency_contacts?.length ? (
            <section>
              <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
                Emergency contacts
              </h2>
              <ul className="mt-3 space-y-2">
                {info.emergency_contacts.map((c, i) => (
                  <li key={`${c.phone}-${i}`}>
                    <a
                      href={`tel:${c.phone.replace(/\s+/g, "")}`}
                      className="flex items-center justify-between rounded-xl bg-card p-3 ring-1 ring-border"
                    >
                      <span className="text-sm font-semibold text-ink">{c.label}</span>
                      <span className="text-sm font-semibold text-cherry">{c.phone}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Spectator FAQs */}
          {spectatorFaqs.length > 0 ? (
            <section>
              <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
                Spectator questions
              </h2>
              <div className="mt-3 space-y-2">
                {spectatorFaqs.map((f, i) => (
                  <details key={i} className="rounded-xl bg-card p-3 ring-1 ring-border">
                    <summary className="cursor-pointer text-sm font-semibold text-ink">{f.q}</summary>
                    <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}


      {tab === "riders" ? (
        <div className="px-5 pt-4 pb-8 animate-fade-in">
          {rosterStatus !== "ok" && !ridersQ.isLoading ? (
            <div className="mt-2 rounded-2xl border border-dashed border-border bg-card p-6 text-center">
              <Lock className="mx-auto h-5 w-5 text-cherry" />
              {rosterStatus === "signin" ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-ink">Riders only</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    Sign in to see the full rider list, bib numbers and start batches.
                  </p>
                  <Link
                    to="/auth"
                    className="mt-4 inline-block rounded-full bg-cherry px-5 py-2 text-sm font-semibold text-white"
                  >
                    Sign in
                  </Link>
                </>
              ) : (
                <>
                  <p className="mt-2 text-sm font-semibold text-ink">Rider list opens race week</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    Bib numbers and start batches go live{" "}
                    {rosterOpensAt ? `on ${formatDate(rosterOpensAt)}` : "one week before the event"} — a
                    week before race day.
                  </p>
                </>
              )}
            </div>
          ) : (
          <>
          <SearchBox value={search} onChange={setSearch} placeholder="Search rider name or race number…" />
          <div className="mt-3">
            <CategoryFilter categories={categories} value={categoryFilter} onChange={setCategoryFilter} />
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {([
              { id: "class", label: "Classes" },
              { id: "start", label: "Start times" },
              { id: "bib", label: "Race numbers" },
              { id: "category", label: "Groups" },
              { id: "name", label: "A–Z" },
            ] as { id: GroupBy; label: string }[]).map((o) => {
              const active = groupBy === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setGroupBy(o.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                    active
                      ? "bg-ink text-white ring-ink"
                      : "bg-card text-ink-soft ring-border"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>

          {ridersQ.isLoading ? (
            <p className="mt-6 text-center text-sm text-ink-soft">Loading riders…</p>

          ) : roster.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
              <Users className="mx-auto h-5 w-5 text-cherry" />
              <p className="mt-2">
                The rider list will appear here once entries are synced from Entry Ninja.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                {filtered.length} rider{filtered.length === 1 ? "" : "s"}
              </p>
              {startGroups.length === 0 ? (
                <p className="text-center text-sm text-ink-soft">No riders match that search.</p>
              ) : (
                startGroups.map((g, gi) => {
                  const promo =
                    promos.length && gi > 0 && gi % 3 === 0
                      ? promos[(Math.floor(gi / 3) - 1) % promos.length]
                      : null;
                  return (
                  <Fragment key={g.key}>
                  {promo ? (
                    <div className="py-1">
                      <PromoCodeCard promo={promo} />
                    </div>
                  ) : null}
                  <section className="rounded-2xl bg-card p-3 ring-1 ring-border">
                    <header className="flex items-start gap-2 pb-2">
                      <p className="min-w-0 flex-1 font-display text-sm font-bold leading-snug text-ink">
                        {g.label}
                      </p>
                      <span className="shrink-0 rounded-md bg-accent px-2 py-0.5 font-mono text-[11px] font-bold text-cherry-deep">
                        {g.startTime ? g.startTime : `${g.rows.length}`}
                      </span>
                    </header>
                    <ul className="divide-y divide-border">
                      {g.rows.map((r) => {
                        const link = riderResultUrl(results?.results_rider_url_template ?? null, r.bib_number);
                        return (
                          <li key={r.id}>
                            <Link
                              to="/spectate/$eventId/rider/$entrantId"
                              params={{ eventId, entrantId: r.id }}
                              className="flex items-center gap-3 py-2 text-sm active:opacity-70"
                            >
                              <span className="grid h-7 min-w-[2.75rem] place-items-center rounded-md bg-background px-1 font-mono text-[11px] font-semibold text-ink-soft ring-1 ring-border">
                                {r.bib_number || "—"}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-ink">
                                  {r.full_name}
                                </span>
                                {groupBy !== "category" && r.category ? (
                                  <span className="block truncate text-[11px] text-ink-soft">
                                    {r.category}
                                  </span>
                                ) : null}
                              </span>
                              {link ? <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-soft" /> : null}
                              <ChevronRight className="h-4 w-4 shrink-0 text-cherry" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                  </Fragment>
                  );
                })
              )}
            </div>
          )}
          </>
          )}
        </div>

      ) : null}

      {tab === "results" ? (
        <div className="px-5 pt-4 pb-8 animate-fade-in">
          {results?.results_url ? (
            <a
              href={results.results_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-4 flex items-center justify-between rounded-2xl bg-cherry px-4 py-3 text-sm font-semibold text-white"
            >
              Open official results
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}

          {resultsQ.isLoading ? (
            <p className="mt-6 text-center text-sm text-ink-soft">Loading results…</p>
          ) : !results || results.sets.length === 0 || !results.results_published ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
              <Trophy className="mx-auto h-5 w-5 text-cherry" />
              <p className="mt-2">
                Results aren’t published yet. They’ll show here as soon as timing data lands.
              </p>
            </div>
          ) : (
            <>
              {results.sets.length > 1 ? (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {results.sets.map((s) => {
                    const active = s.id === currentSetId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveSet(s.id)}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                          active ? "bg-cherry text-white ring-cherry" : "bg-card text-ink-soft ring-border"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-2">
                <SearchBox value={search} onChange={setSearch} placeholder="Search rider name or bib…" />
              </div>
              <div className="mt-3">
                <CategoryFilter categories={categories} value={categoryFilter} onChange={setCategoryFilter} />
              </div>

              <div className="mt-4 space-y-4">
                {resultGroups.length === 0 ? (
                  <p className="text-center text-sm text-ink-soft">No results match that search.</p>
                ) : (
                  resultGroups.map((g, gi) => {
                    const promo =
                      promos.length && gi > 0 && gi % 3 === 0
                        ? promos[(Math.floor(gi / 3) - 1) % promos.length]
                        : null;
                    return (
                      <Fragment key={g.key}>
                        {promo ? (
                          <div className="py-1">
                            <PromoCodeCard promo={promo} />
                          </div>
                        ) : null}
                        <section className="rounded-2xl bg-card p-3 ring-1 ring-border">
                          <header className="flex items-start gap-2 pb-2">
                            <p className="min-w-0 flex-1 font-display text-sm font-bold leading-snug text-ink">
                              {g.label}
                            </p>
                            <span className="shrink-0 rounded-md bg-accent px-2 py-0.5 font-mono text-[11px] font-bold text-cherry-deep">
                              {g.rows.length}
                            </span>
                          </header>
                          <ol className="divide-y divide-border">
                            {g.rows.map((r) => (
                              <li key={r.id} className="flex items-center gap-3 py-2">
                                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cherry text-[11px] font-bold text-white">
                                  {r.position ?? "—"}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-ink">{r.full_name}</p>
                                  <p className="truncate text-[11px] text-ink-soft">
                                    {r.bib_number ? `#${r.bib_number} · ` : ""}
                                    {r.status ?? ""}
                                    {r.gap_text ? ` +${r.gap_text}` : ""}
                                  </p>
                                </div>
                                <span className="font-mono text-xs font-semibold text-ink">
                                  {r.time_text ?? "—"}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </section>
                      </Fragment>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 ring-1 ring-border">
      <Search className="h-4 w-4 text-ink-soft" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
      />
    </label>
  );
}

function FactCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Info;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-cherry-deep">
          <Icon className="h-4 w-4" />
        </span>
        <p className="font-display text-sm font-bold text-ink">{title}</p>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}

function CategoryFilter({
  categories,
  value,
  onChange,
}: {
  categories: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (categories.length === 0) return null;
  const options = ["__all", ...categories];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {options.map((c) => {
        const active = c === value;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
              active ? "bg-cherry text-white ring-cherry" : "bg-card text-ink-soft ring-border"
            }`}
          >
            {c === "__all" ? "All categories" : c}
          </button>
        );
      })}
    </div>
  );
}
