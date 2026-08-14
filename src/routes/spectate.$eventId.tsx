import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  Clock,
  Coffee,
  Flag,
  Info,
  MapPin,
  Toilet,
  Trophy,
  Users,
} from "lucide-react";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import { formatDate, formatTime } from "@/lib/mock-data";
import { getSpectatorRoster, type SpectatorEntrant } from "@/lib/spectator.functions";
import { LockedSection } from "@/components/locked-section";
import { useSession } from "@/lib/auth";
import { brandHeader } from "@/lib/event-brand";
import { buildMapEmbedSrc, buildMapLink, resolveVenuePoint } from "@/lib/map-embed";
import { VenueMiniMap } from "@/components/venue-mini-map";

export const Route = createFileRoute("/spectate/$eventId")({
  head: ({ params }) => ({
    meta: [
      { title: `Spectate — Red Cherry Events` },
      {
        name: "description",
        content: `Spectator info for this Red Cherry event: parking, food, toilets, start times and start & finish lists.`,
      },
      { property: "og:title", content: "Spectate — Red Cherry Events" },
      {
        property: "og:description",
        content: `Spectator info: parking, food, toilets, start times and start & finish lists.`,
      },
    ],
    // params referenced so linter is happy without exposing IDs in tags.
    ...({ _: params } as Record<string, unknown>),
  }),
  component: SpectatorEventPage,
});

type Tab = "info" | "start" | "finish";

function SpectatorEventPage() {
  useHydratedStore();
  const { eventId } = Route.useParams();
  const event = useAdminStore((s) => s.events.find((e) => e.id === eventId));
  const [tab, setTab] = useState<Tab>("info");
  const [categoryFilter, setCategoryFilter] = useState<string>("__all");

  const { user, loading: sessionLoading } = useSession();
  const locked = !sessionLoading && !user;

  const fetchRoster = useServerFn(getSpectatorRoster);
  const rosterQ = useQuery<SpectatorEntrant[]>({
    queryKey: ["spectator-roster", eventId],
    queryFn: () => fetchRoster({ data: { eventId } }),
    staleTime: 30_000,
    enabled: !locked,
  });
  const roster: SpectatorEntrant[] = rosterQ.data ?? [];

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of roster) if (r.category) set.add(r.category);
    return Array.from(set).sort();
  }, [roster]);

  const filtered = useMemo(() => {
    if (categoryFilter === "__all") return roster;
    return roster.filter((r) => (r.category ?? "") === categoryFilter);
  }, [roster, categoryFilter]);

  // Group start list by batch, order by batch start time.
  const batches = event?.batches ?? [];
  const batchLookup = useMemo(() => {
    const m = new Map<string, { name: string; startTime: string }>();
    for (const b of batches) m.set(b.name, { name: b.name, startTime: b.startTime });
    return m;
  }, [batches]);

  const startGroups = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; label: string; startTime: string; rows: SpectatorEntrant[] }
    >();
    for (const r of filtered) {
      const key = r.batch ?? "__unassigned";
      const meta = r.batch ? batchLookup.get(r.batch) : undefined;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: r.batch ?? "Unassigned",
          startTime: meta?.startTime ?? "",
          rows: [],
        });
      }
      groups.get(key)!.rows.push(r);
    }
    for (const g of groups.values()) {
      g.rows.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
    }
    return Array.from(groups.values()).sort((a, b) => {
      if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
      if (a.startTime) return -1;
      if (b.startTime) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [filtered, batchLookup]);

  const finishers = useMemo(
    () =>
      filtered
        .filter((r) => !!r.finished_at)
        .sort(
          (a, b) => new Date(a.finished_at!).getTime() - new Date(b.finished_at!).getTime(),
        ),
    [filtered],
  );

  if (!event) {
    return (
      <div className="p-8 text-center">
        <p className="text-ink">Event not available.</p>
        <Link to="/spectate" className="mt-4 inline-block font-semibold text-cherry">
          Back to Spectate
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
              Spectator info · {event.discipline}
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
            { id: "info", label: "Venue", icon: Info },
            { id: "start", label: "Start list", icon: Flag },
            { id: "finish", label: "Finishers", icon: Trophy },
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
          <FactCard icon={Car} title="Parking">
            {event.spectatorParking ?? "Parking details will be shared closer to race day."}
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

          {/* Location + navigate */}
          <section>
            <h2 className="font-display text-[13px] font-bold uppercase tracking-wider text-ink-soft">
              Venue
            </h2>
            {event.mapQuery || event.location ? (() => {
              const mapLink = buildMapLink({ mapUrl: event.mapQuery, address: event.location });
              const embedSrc = buildMapEmbedSrc({ mapUrl: event.mapQuery, address: event.location });
              const venuePoint = resolveVenuePoint({ mapUrl: event.mapQuery });
              if (!mapLink || (!embedSrc && !venuePoint)) return <p className="mt-3 text-xs text-ink-soft">No venue set yet.</p>;
              return (
              <a
                href={mapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block overflow-hidden rounded-2xl ring-1 ring-border"
              >
                {venuePoint ? (
                  <div className="pointer-events-none h-44 w-full">
                    <VenueMiniMap lat={venuePoint.lat} lng={venuePoint.lng} height="176px" />
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
                <div className="flex items-center justify-between bg-card px-3 py-2 text-xs">
                  <span className="font-semibold text-ink">{event.mapQuery || event.location}</span>
                  <span className="font-semibold text-cherry">Navigate ↗</span>
                </div>
              </a>
              );
            })() : (
              <p className="mt-3 text-xs text-ink-soft">No venue set yet.</p>
            )}
          </section>

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
        </div>
      ) : null}

      {tab === "start" || tab === "finish" ? (
        <div className="px-5 pt-4 pb-8 animate-fade-in">
          <CategoryFilter
            categories={categories}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />

          {locked ? (
            <LockedSection locked message="Sign in to view start and finish lists">
              <ul className="mt-4 space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-border">
                    <span className="h-7 w-11 rounded-md bg-secondary" />
                    <span className="h-3 flex-1 rounded bg-secondary" />
                  </li>
                ))}
              </ul>
            </LockedSection>
          ) : rosterQ.isLoading ? (
            <p className="mt-6 text-center text-sm text-ink-soft">Loading riders…</p>
          ) : roster.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
              <Users className="mx-auto h-5 w-5 text-cherry" />
              <p className="mt-2">
                The rider list will appear here once entries are synced from Entry Ninja.
              </p>
            </div>
          ) : tab === "start" ? (
            <div className="mt-4 space-y-4">
              {startGroups.length === 0 ? (
                <p className="text-center text-sm text-ink-soft">No riders match that filter.</p>
              ) : (
                startGroups.map((g) => (
                  <section key={g.key} className="rounded-2xl bg-card p-3 ring-1 ring-border">
                    <header className="flex items-center gap-2 pb-2">
                      <Clock className="h-3.5 w-3.5 text-cherry" />
                      <p className="font-display text-sm font-bold text-ink">{g.label}</p>
                      <span className="ml-auto rounded-md bg-accent px-2 py-0.5 font-mono text-[11px] font-bold text-cherry-deep">
                        {g.startTime || "TBC"}
                      </span>
                    </header>
                    <ul className="divide-y divide-border">
                      {g.rows.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center gap-3 py-2 text-sm"
                        >
                          <span className="grid h-7 min-w-[2.75rem] place-items-center rounded-md bg-background px-1 font-mono text-[11px] font-semibold text-ink-soft ring-1 ring-border">
                            {r.bib_number || "—"}
                          </span>
                          <span className="flex-1 truncate font-medium text-ink">{r.full_name}</span>
                          {r.category ? (
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
                              {r.category}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          ) : (
            <div className="mt-4">
              {finishers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
                  <Trophy className="mx-auto h-5 w-5 text-cherry" />
                  <p className="mt-2">
                    Finish times will appear here as riders cross the line.
                  </p>
                </div>
              ) : (
                <ol className="space-y-2">
                  {finishers.map((r, i) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-border"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-cherry text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{r.full_name}</p>
                        <p className="text-[11px] text-ink-soft">
                          {r.category ? `${r.category} · ` : ""}
                          {r.bib_number ? `#${r.bib_number} · ` : ""}
                          {new Date(r.finished_at!).toLocaleTimeString("en-ZA", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
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
