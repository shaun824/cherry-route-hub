import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, ChevronRight, Newspaper, Image as ImageIcon, Tag, MapPin, Clock } from "lucide-react";
import { BrandMark, SectionTitle, TypeBadge } from "@/components/ui-bits";
import { SponsorScroller } from "@/components/sponsor-scroller";
import { currentRider, formatDate, formatTime, relativeTime } from "@/lib/mock-data";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Red Cherry Events — Rider Hub" },
      { name: "description", content: "Your race dashboard: upcoming events, live news, loyalty and supplier promos." },
      { property: "og:title", content: "Red Cherry Events — Rider Hub" },
      { property: "og:description", content: "Your race dashboard for Red Cherry Events." },
    ],
  }),
  component: Home,
});

function Home() {
  useHydratedStore();
  const events = useAdminStore((s) => s.events);
  const feed = useAdminStore((s) => s.feed);
  const promos = useAdminStore((s) => s.promos);
  const upcoming = events.filter((e) => e.status !== "closed").slice(0, 3);
  const pinned = feed.filter((p) => p.pinned)[0];
  const recentNews = feed.filter((p) => !p.pinned).slice(0, 3);


  return (
    <div>
      {/* Hero header */}
      <div className="relative overflow-hidden cherry-gradient px-5 pb-8 pt-14 text-white" style={{ paddingTop: "calc(env(safe-area-inset-top) + 3.5rem)" }}>
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-black/20 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-3">
            <BrandMark size={44} />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-80">Red Cherry</p>
              <h1 className="font-display text-2xl font-bold leading-tight">Rider Hub</h1>
            </div>
          </div>
          <button
            aria-label="Notifications"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute mt-[-14px] ml-[14px] h-2 w-2 rounded-full bg-white ring-2 ring-cherry" />
          </button>
        </div>

        <div className="relative mt-7">
          <p className="text-sm opacity-85">Welcome back,</p>
          <p className="font-display text-xl font-bold">{currentRider.name}</p>
        </div>

        {/* Loyalty strip */}
        <Link
          to="/profile"
          className="relative mt-5 flex items-center justify-between rounded-2xl bg-white/12 p-3 backdrop-blur ring-1 ring-white/15"
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">
              {currentRider.tier} tier
            </p>
            <p className="text-lg font-bold">{currentRider.points.toLocaleString()} pts</p>
          </div>
          <div className="flex-1 px-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: `${(currentRider.points / (currentRider.points + currentRider.pointsToNext)) * 100}%`,
                }}
              />
            </div>
            <p className="mt-1 text-[10px] opacity-80">
              {currentRider.pointsToNext} pts to {currentRider.nextTier}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 opacity-70" />
        </Link>
      </div>

      {/* Quick links */}
      <div className="-mt-5 grid grid-cols-4 gap-2 px-4">
        {[
          { to: "/feed", label: "News", icon: Newspaper },
          { to: "/events", label: "Events", icon: MapPin },
          { to: "/gallery", label: "Gallery", icon: ImageIcon },
          { to: "/promos", label: "Promos", icon: Tag },
        ].map((q) => {
          const Icon = q.icon;
          return (
            <Link
              key={q.to}
              to={q.to}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-cherry-deep">
                <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
              </span>
              <span className="text-[11px] font-semibold text-ink">{q.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Pinned notice */}
      {pinned ? (
        <div className="mt-6 px-5">
          <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4">
            <div className="flex items-center gap-2">
              <TypeBadge type={pinned.type} />
              <span className="text-[11px] text-amber-900/80">Pinned · {relativeTime(pinned.postedAt)}</span>
            </div>
            <p className="mt-2 font-display font-bold text-ink">{pinned.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{pinned.body}</p>
          </div>
        </div>
      ) : null}

      {/* Upcoming events */}
      <SectionTitle title="Upcoming events" action="See all" actionTo="/events" />
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2">
        {upcoming.map((e) => (
          <Link
            key={e.id}
            to="/events/$eventId"
            params={{ eventId: e.id }}
            className={`snap-start shrink-0 w-64 overflow-hidden rounded-2xl bg-gradient-to-br ${e.heroColor} p-4 text-white shadow-md`}
          >
            <div className="flex items-center justify-between">
              <TypeBadge type={e.status} />
              <span className="text-[11px] font-semibold uppercase tracking-widest opacity-80">
                {e.discipline}
              </span>
            </div>
            <p className="mt-6 font-display text-lg font-bold leading-tight">{e.name}</p>
            <div className="mt-3 flex items-center gap-3 text-[11px] opacity-90">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {formatDate(e.date)} · {formatTime(e.date)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] opacity-85">
              <MapPin className="h-3.5 w-3.5" /> {e.location} · {e.distanceKm}km
            </div>
          </Link>
        ))}
      </div>

      {/* Latest news preview */}
      <SectionTitle title="Latest from the pits" action="Open feed" actionTo="/feed" />
      <ul className="space-y-2 px-5">
        {recentNews.map((p) => (
          <li key={p.id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
            <div className="flex items-center gap-2">
              <TypeBadge type={p.type} />
              <span className="text-[11px] text-muted-foreground">{relativeTime(p.postedAt)}</span>
            </div>
            <p className="mt-1.5 font-display text-[15px] font-bold text-ink">{p.title}</p>
            <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{p.body}</p>
          </li>
        ))}
      </ul>

      {/* Promo teaser */}
      {promos[0] ? (
        <>
          <SectionTitle title="Supplier promos" action="View all" actionTo="/promos" />
          <div className="px-5 pb-2">
            <div className="rounded-2xl bg-ink p-4 text-white">
              <p className="text-[11px] font-semibold uppercase tracking-widest opacity-70">
                {promos[0].brand}
              </p>
              <p className="mt-1 font-display text-lg font-bold">{promos[0].title}</p>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2">
                <span className="font-mono text-sm tracking-wider">{promos[0].code}</span>
                <span className="rounded-md bg-cherry px-2 py-1 text-[11px] font-bold">
                  {promos[0].discount} OFF
                </span>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Sponsor logo scroller */}
      <SponsorScroller />

      <div className="pb-6" />

    </div>
  );
}
