import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  Calendar,
  CalendarDays,
  ChevronRight,
  Facebook,
  Globe,
  Handshake,
  Image as ImageIcon,
  Instagram,
  LogIn,
  MapPin,
  Music2,
  Newspaper,
  Sparkles,
  ShieldCheck,
  Tag,
  Trophy,
  Twitter,
  Youtube,
} from "lucide-react";

import { BrandMark, SectionTitle, TypeBadge } from "@/components/ui-bits";
import { SponsorScroller } from "@/components/sponsor-scroller";
import { currentRider, relativeTime } from "@/lib/mock-data";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import { useSession } from "@/lib/auth";
import { fetchMyEvents, type MyEventRow } from "@/lib/my-events";
import type { QuickLinkIcon } from "@/lib/settings";

const QUICK_ICONS: Record<QuickLinkIcon, typeof Newspaper> = {
  Newspaper,
  MapPin,
  Image: ImageIcon,
  Tag,
  Bell,
  Sparkles,
  ShieldCheck,
  Handshake,
  Trophy,
  Calendar,
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Red Cherry Events — Rider Hub" },
      { name: "description", content: "Your race dashboard: next event countdown, event details, news and supplier promos." },
      { property: "og:title", content: "Red Cherry Events — Rider Hub" },
      { property: "og:description", content: "Your race dashboard for Red Cherry Events." },
    ],
  }),
  component: Home,
});

function Home() {
  useHydratedStore();
  const { user, loading } = useSession();
  const feed = useAdminStore((s) => s.feed);
  const promos = useAdminStore((s) => s.promos);
  const branding = useAdminStore((s) => s.settings.branding);
  const quickLinks = useAdminStore((s) => s.settings.quickLinks).filter((q) => q.enabled);
  const pinned = feed.filter((p) => p.pinned)[0];
  const recentNews = feed.filter((p) => !p.pinned).slice(0, 3);
  const qlCols = Math.min(Math.max(quickLinks.length, 1), 4);

  return (
    <div>
      {/* Hero header */}
      <div
        className="relative overflow-hidden cherry-gradient px-5 pb-8 pt-14 text-white"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 3.5rem)" }}
      >
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-black/20 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-3">
            <BrandMark size={44} />
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-80">
                {branding.eyebrow}
              </p>
              <h1 className="font-display text-2xl font-bold leading-tight">{branding.tagline}</h1>
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
          <p className="text-sm opacity-85">{branding.welcomeMessage}</p>
          <p className="font-display text-xl font-bold">
            {user ? currentRider.name : "Rider"}
          </p>
        </div>

        {user ? (
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
        ) : null}
      </div>

      {/* Primary: next event or sign-in CTA */}
      <div className="mt-4 px-5">
        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-secondary" />
        ) : user ? (
          <NextEventCard />
        ) : (
          <SignedOutCTA />
        )}
      </div>

      {/* Quick links */}
      {quickLinks.length > 0 ? (
        <div
          className="mt-4 grid gap-2 px-4"
          style={{ gridTemplateColumns: `repeat(${qlCols}, minmax(0, 1fr))` }}
        >
          {quickLinks.map((q) => {
            const Icon = QUICK_ICONS[q.icon] ?? Sparkles;
            return (
              <Link
                key={q.id}
                to={q.to}
                className="flex flex-col items-center gap-2 rounded-2xl bg-card px-2 py-4 shadow-sm ring-1 ring-border"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-cherry-deep">
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <span className="truncate max-w-full text-[11px] font-semibold text-ink">
                  {q.label}
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}

      {/* Pinned notice */}
      {pinned ? (
        <div className="mt-6 px-5">
          <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4">
            <div className="flex items-center gap-2">
              <TypeBadge type={pinned.type} />
              <span className="text-[11px] text-amber-900/80">
                Pinned · {relativeTime(pinned.postedAt)}
              </span>
            </div>
            <p className="mt-2 font-display font-bold text-ink">{pinned.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{pinned.body}</p>
          </div>
        </div>
      ) : null}

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

      <SponsorScroller />

      <div className="pb-6" />
    </div>
  );
}

function SignedOutCTA() {
  return (
    <div className="rounded-3xl bg-card p-6 text-center shadow-sm ring-1 ring-border">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent text-cherry-deep">
        <LogIn className="h-7 w-7" />
      </div>
      <p className="mt-3 font-display text-xl font-bold text-ink">Sign in to see your events</p>
      <p className="mt-1.5 text-sm text-ink-soft">
        Sign in to unlock your race dashboard — event details, packing lists, venue navigation,
        and the group chat for every event you're entered in.
      </p>
      <Link
        to="/auth"
        search={{ next: "/my-events" }}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl cherry-gradient px-5 py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98] transition"
      >
        Sign in <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function daysDiff(target: Date, from: Date) {
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const b = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  return Math.round((a - b) / 86400000);
}

function countdownLabel(dateStr: string): { primary: string; secondary: string; live: boolean } {
  const now = new Date();
  const target = new Date(dateStr);
  const diff = daysDiff(target, now);
  if (diff < -1) return { primary: "Just finished", secondary: target.toLocaleDateString("en-ZA", { day: "numeric", month: "short" }), live: false };
  if (diff === -1) return { primary: "Yesterday", secondary: "Hope you had a great one!", live: false };
  if (diff === 0) return { primary: "Today", secondary: "It's race day — good luck!", live: true };
  if (diff === 1) return { primary: "Tomorrow", secondary: "Final prep — check your packing list", live: true };
  return { primary: `${diff} days`, secondary: "to go", live: false };
}

function NextEventCard() {
  const q = useQuery({
    queryKey: ["my-events-home"],
    queryFn: () => fetchMyEvents(),
    staleTime: 60_000,
  });

  if (q.isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-secondary" />;
  }

  const rows = q.data ?? [];
  const now = Date.now();
  const upcoming = rows
    .filter((r) => new Date(r.event.event_date).getTime() >= now - 86400000)
    .sort((a, b) => new Date(a.event.event_date).getTime() - new Date(b.event.event_date).getTime());

  if (upcoming.length === 0) {
    return <NoEventsCard hasAnyLinked={rows.length > 0} />;
  }

  const next = upcoming[0];
  const rest = upcoming.slice(1);

  return (
    <div className="space-y-3">
      <NextEventHero row={next} />
      {rest.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-ink-soft">
            Your other events
          </p>
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {rest.map((r) => (
              <Link
                key={r.event_entrant_id}
                to="/my-events/$eventId"
                params={{ eventId: r.event_id }}
                className={`snap-start shrink-0 w-56 rounded-2xl bg-gradient-to-br ${r.event.hero_color ?? "from-cherry to-cherry-deep"} p-3 text-white shadow-sm`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest opacity-85">
                  {r.event.discipline}
                </p>
                <p className="mt-1 font-display text-sm font-bold leading-tight line-clamp-2">
                  {r.event.name}
                </p>
                <p className="mt-2 flex items-center gap-1 text-[11px] opacity-90">
                  <CalendarDays className="h-3 w-3" />
                  {new Date(r.event.event_date).toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
                <EventSocialRow links={r.event.social_links} compact />

              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NextEventHero({ row }: { row: MyEventRow }) {
  const cd = countdownLabel(row.event.event_date);
  const date = new Date(row.event.event_date);
  return (
    <Link
      to="/my-events/$eventId"
      params={{ eventId: row.event_id }}
      className={`block overflow-hidden rounded-3xl bg-gradient-to-br ${row.event.hero_color ?? "from-cherry to-cherry-deep"} p-5 text-white shadow-md ring-1 ring-black/5 active:scale-[0.99] transition`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest opacity-85">
          Your next event · {row.event.discipline}
        </p>
        {cd.live ? (
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest backdrop-blur">
            Live
          </span>
        ) : null}
      </div>
      <p className="mt-1 font-display text-2xl font-bold leading-tight">{row.event.name}</p>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-5xl font-black leading-none tracking-tight">
            {cd.primary}
          </p>
          <p className="mt-1 text-xs opacity-90">{cd.secondary}</p>
        </div>
        <div className="rounded-2xl bg-white/12 px-3 py-2 text-right backdrop-blur">
          <p className="text-[10px] font-semibold uppercase tracking-widest opacity-85">
            Start
          </p>
          <p className="font-display text-sm font-bold">
            {date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
          </p>
          <p className="text-[11px] opacity-90">
            {date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs opacity-90">
        <MapPin className="h-3.5 w-3.5" />
        <span className="truncate">{row.event.location}</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-semibold">
        {row.category ? (
          <span className="rounded bg-white/15 px-1.5 py-0.5 backdrop-blur">{row.category}</span>
        ) : null}
        {row.batch ? (
          <span className="rounded bg-white/15 px-1.5 py-0.5 backdrop-blur">Batch {row.batch}</span>
        ) : null}
        {row.bib_number ? (
          <span className="rounded bg-white px-1.5 py-0.5 text-cherry-deep">
            #{row.bib_number}
          </span>
        ) : null}
      </div>

      <EventSocialRow links={row.event.social_links} />

      <div className="mt-4 flex items-center justify-between rounded-xl bg-white/15 px-3 py-2 backdrop-blur">
        <span className="text-xs font-bold">Open my event</span>
        <ChevronRight className="h-4 w-4" />
      </div>
    </Link>
  );
}


function NoEventsCard({ hasAnyLinked }: { hasAnyLinked: boolean }) {
  return (
    <div className="rounded-3xl bg-card p-6 text-center shadow-sm ring-1 ring-border">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent text-cherry-deep">
        <CalendarDays className="h-7 w-7" />
      </div>
      <p className="mt-3 font-display text-lg font-bold text-ink">
        {hasAnyLinked ? "No upcoming events" : "Link your entry"}
      </p>
      <p className="mt-1.5 text-sm text-ink-soft">
        {hasAnyLinked
          ? "You're all caught up. Once you enter your next Red Cherry event through Entry Ninja, it'll show up here."
          : "Confirm your ID number so we can match you to your Entry Ninja entries and show your events here."}
      </p>
      <Link
        to="/my-events"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl cherry-gradient px-5 py-2.5 text-sm font-bold text-white"
      >
        Open My Events <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
