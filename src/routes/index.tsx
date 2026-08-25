import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Activity,
  Bell,
  Bike,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Facebook,
  Globe,
  Handshake,
  Image as ImageIcon,
  Instagram,
  LogIn,
  MapPin,
  Motorbike,
  Music2,
  Newspaper,
  Sparkles,
  ShieldCheck,
  Tag,
  Trophy,
  Twitter,
  X,
  Youtube,
} from "lucide-react";

import { BrandMark, SectionTitle, TypeBadge } from "@/components/ui-bits";
import { SponsorScroller } from "@/components/sponsor-scroller";
import { SocialWall } from "@/components/social-wall";
import { InstallPrompt, PushOptIn } from "@/components/push-optin";
import { AdminAuditWarnings } from "@/components/admin-audit-warnings";
import { formatDate, relativeTime, type Event } from "@/lib/mock-data";
import { getEventSport } from "@/lib/event-sport";
import { useAdminStore } from "@/lib/store";
import { PromoCarousel } from "@/components/promo-carousel";
import { eventPromosFor, type EventPromo } from "@/lib/event-promos";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import { useSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyEvents, type MyEventRow } from "@/lib/my-events";
import type { QuickLinkIcon } from "@/lib/settings";
import { brandHeader } from "@/lib/event-brand";
import { curatedSponsorsFor } from "@/lib/event-sponsor-overrides";



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
      { name: "description", content: "Your race dashboard: next event countdown plus upcoming motorbike and bicycle events." },
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
  const allEvents = useAdminStore((s) => s.events);
  const promos = useAdminStore((s) => s.promos);
  const branding = useAdminStore((s) => s.settings.branding);
  const quickLinks = useAdminStore((s) => s.settings.quickLinks).filter((q) => q.enabled);
  const pinned = feed.filter((p) => p.pinned)[0];
  const pinnedGeneral = feed.filter((p) => p.pinned && !p.eventId && p.type !== "weather")[0];
  const qlCols = Math.min(Math.max(quickLinks.length, 1), 4);
  // Home shows every live admin-managed supplier offer, whatever event it runs on.
  const homePromos = useMemo<EventPromo[]>(
    () => promos.filter(isPromoLive).map(toEventPromo),
    [promos],
  );
  const [notifOpen, setNotifOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);

  const upcoming = allEvents
    .filter((e) => (e.lifecycle ?? "published") === "published")
    .filter((e) => new Date(e.date).getTime() >= Date.now() - 12 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Determine which sport(s) this signed-in rider has actually entered.
  // The query shares its cache with NextEventCard.
  const myEventsQ = useQuery({
    queryKey: ["my-events-home"],
    queryFn: () => fetchMyEvents(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const enteredSports = new Set<"moto" | "mtb">(
    (myEventsQ.data ?? []).map((r) => getEventSport(r.event.discipline, r.event.name)),
  );
  const hasEntered = !!user && enteredSports.size > 0;
  // When the rider has entered events, collapse the sport they haven't entered.
  const collapseMoto = hasEntered && !enteredSports.has("moto");
  const collapseMtb = hasEntered && !enteredSports.has("mtb");



  const profile = useQuery({
    queryKey: ["home-profile", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const displayName =
    profile.data?.full_name?.trim() ||
    (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.full_name ||
    (user?.user_metadata as { full_name?: string; name?: string } | undefined)?.name ||
    user?.email?.split("@")[0] ||
    "Rider";

  // Hero: the rider's own next event (signed-in only).
  const myNext = (myEventsQ.data ?? [])
    .filter((r) => new Date(r.event.event_date).getTime() >= Date.now() - 12 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.event.event_date).getTime() - new Date(b.event.event_date).getTime())[0];
  const heroEventId = user ? (myNext?.event_id ?? null) : null;
  const myEventIds = new Set((myEventsQ.data ?? []).map((r) => r.event_id));

  // An event is "happening now" from the day before until 12h after its date.
  const liveNow =
    upcoming.find((e) => {
      const t = new Date(e.date).getTime();
      return t - Date.now() <= 24 * 60 * 60 * 1000;
    }) ?? null;

  // Spotlight: never repeat the hero. Signed-in riders get the next event they
  // haven't entered, in the sport they actually ride — most riders do either MTB
  // or moto, not both, so we prefer the sport of their own next event.
  const notEntered = upcoming.filter((e) => e.id !== heroEventId && !myEventIds.has(e.id));
  const primarySport: "moto" | "mtb" | null = myNext
    ? getEventSport(myNext.event.discipline, myNext.event.name)
    : enteredSports.size === 1
      ? [...enteredSports][0]
      : null;
  const sameSportPick = primarySport
    ? (notEntered.find((e) => getEventSport(e.discipline, e.name) === primarySport) ?? null)
    : enteredSports.size
      ? (notEntered.find((e) => enteredSports.has(getEventSport(e.discipline, e.name))) ?? null)
      : null;
  const spotlightSource = user
    ? (sameSportPick ?? notEntered[0] ?? null)
    : (liveNow ?? upcoming[0] ?? null);

  const spotlight = spotlightSource
    ? {
        id: spotlightSource.id,
        name: spotlightSource.name,
        location: spotlightSource.location,
        date: spotlightSource.date,
        logoUrl: spotlightSource.logoUrl ?? null,
        heroColor: spotlightSource.heroColor ?? null,
        description: spotlightSource.description ?? "",
        entered: myEventIds.has(spotlightSource.id),
        happeningNow: !!liveNow && liveNow.id === spotlightSource.id,
      }
    : null;

  // Anything already featured above is hidden from the sport lists.
  const hiddenIds = new Set([heroEventId, spotlight?.id].filter(Boolean) as string[]);
  const motoEvents = upcoming
    .filter((e) => !hiddenIds.has(e.id) && getEventSport(e.discipline, e.name) === "moto")
    .slice(0, 4);
  const mtbEvents = upcoming
    .filter((e) => !hiddenIds.has(e.id) && getEventSport(e.discipline, e.name) === "mtb")
    .slice(0, 4);

  const notifications = [pinned, ...feed.filter((p) => !p.pinned)].filter(Boolean).slice(0, 8);
  const hasUnread = notifications.length > 0;
  
  // Website news (Red Cherry + PE Plett) shown to everyone on the home screen.
  const latestNews = feed
    .filter((p) => p.type === "news" || Boolean(p.sourceUrl))
    .slice(0, 4);



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
            onClick={() => setNotifOpen(true)}
            className="relative grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur"
          >
            <Bell className="h-5 w-5" />
            {hasUnread ? (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-white ring-2 ring-cherry" />
            ) : null}
          </button>
        </div>

        <div className="relative mt-7 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm opacity-85">{branding.welcomeMessage}</p>
            <p className="font-display text-xl font-bold">
              {user ? displayName : "Rider"}
            </p>
          </div>
          <TitleSponsorBadge
            name={branding.titleSponsorName}
            logoUrl={branding.titleSponsorLogoUrl}
            url={branding.titleSponsorUrl}
          />
        </div>

      </div>

      {/* Primary: for signed-in riders their own next event; guests get the
          event that matters right now, with no sign-in wall. */}
      {loading ? (
        <div className="mt-4 px-5">
          <div className="h-40 animate-pulse rounded-2xl bg-secondary" />
        </div>
      ) : user ? (
        <>
          <SectionTitle title="View details on your next event" />
          <div className="px-5">
            <NextEventCard />
          </div>
        </>
      ) : null}


      {!loading && !user && spotlight ? (
        <>
          <SectionTitle title={spotlight.happeningNow ? "Happening now" : "Next up"} />
          <div className="px-5">
            <EventSpotlight
              eventId={spotlight.id}
              name={spotlight.name}
              location={spotlight.location}
              date={spotlight.date}
              logoUrl={spotlight.logoUrl}
              heroColor={spotlight.heroColor}
              description={spotlight.description}
              entered={false}
              guest
              happeningNow={spotlight.happeningNow}
            />
          </div>
          {/* News is shown once, in the "Latest news" section below. */}

          <div className="mt-4 px-5">
            <SignedOutCTA />
          </div>
        </>
      ) : null}

      <AdminAuditWarnings />

      <div className="mt-4 space-y-3 px-5">
        <PushOptIn />
        <InstallPrompt />
      </div>

      {/* Spotlight on another event — discovery for riders already entered */}
      {user && spotlight ? (
        <>
          <SectionTitle
            title={
              spotlight.entered
                ? "View details on your next event"
                : "More events you might like"
            }
          />

          <div className="px-5">
            <EventSpotlight
              eventId={spotlight.id}
              name={spotlight.name}
              location={spotlight.location}
              date={spotlight.date}
              logoUrl={spotlight.logoUrl}
              heroColor={spotlight.heroColor}
              description={spotlight.description}
              entered={spotlight.entered}
            />
          </div>
        </>
      ) : null}

      {/* Quick links */}
      {quickLinks.length > 0 ? (
        <>
          <SectionTitle title="Quick links" />
          <div
            className="grid gap-2 px-4"
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
        </>
      ) : null}

      {/* Pinned general notice (slim, expandable) */}
      {pinnedGeneral ? (
        <div className="mt-5 px-5">
          <button
            type="button"
            onClick={() => setNoticeOpen((v) => !v)}
            className="w-full rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-left"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold text-ink">
                  {pinnedGeneral.title}
                </p>
                <p className="text-[11px] text-amber-900/80">
                  Pinned · {relativeTime(pinnedGeneral.postedAt)}
                </p>
              </div>
              <ChevronRight
                className={`h-4 w-4 shrink-0 text-amber-900/70 transition-transform ${
                  noticeOpen ? "rotate-90" : ""
                }`}
              />
            </div>
            {noticeOpen ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{pinnedGeneral.body}</p>
            ) : null}
          </button>
        </div>
      ) : null}

      {/* Upcoming events by sport */}
      <SportSection
        title="Motorbike events"
        icon={Motorbike}
        sport="moto"
        events={motoEvents}
        collapsed={collapseMoto}
        collapseHint="Not your sport? Tap to view motorbike events."
      />
      <SportSection
        title="Bicycle events"
        icon={Bike}
        sport="mtb"
        events={mtbEvents}
        collapsed={collapseMtb}
        collapseHint="Not your sport? Tap to view bicycle events."
      />

      {/* Latest news — pulled from the Red Cherry and PE Plett websites */}
      {latestNews.length > 0 ? (
        <>
          <SectionTitle title="Latest news" action="View all" actionTo="/feed" />
          <ul className="space-y-2 px-5 pb-2">
            {latestNews.map((p) => (
              <li key={p.id} className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border">
                <div className="flex items-center gap-2">
                  <TypeBadge type={p.type} />
                  <span className="text-[11px] text-muted-foreground">
                    {p.author} · {relativeTime(p.postedAt)}
                  </span>
                </div>
                <p className="mt-1.5 font-display text-sm font-bold text-ink">{p.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{p.body}</p>
                {p.sourceUrl ? (
                  <a
                    href={p.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-semibold text-cherry"
                  >
                    Read the full article
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}


      {/* Promo teaser — same tappable card + reminder pop-up as everywhere else */}
      {homePromos.length > 0 ? (
        <>
          <SectionTitle title="Supplier promos" action="View all" actionTo="/promos" />
          <div className="px-5 pb-2">
            <PromoCarousel promos={homePromos} />
          </div>
        </>
      ) : null}

      {/* Social wall — Red Cherry Events Instagram */}
      <div className="px-5 pt-4">
        <SocialWall title="From the start line" limit={9} />
      </div>





      {/* Sponsor scroller hidden while sponsor assets are being refreshed. */}
      {/* <SponsorScroller /> */}


      <div className="pb-6" />

      <NotificationsSheet
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        items={notifications}
      />
    </div>
  );
}

function EventSpotlight({
  eventId,
  name,
  location,
  date,
  logoUrl,
  heroColor,
  description,
  entered,
  guest = false,
  happeningNow = false,
}: {
  eventId: string;
  name: string;
  location: string;
  date: string;
  logoUrl?: string | null;
  heroColor?: string | null;
  description?: string;
  entered: boolean;
  guest?: boolean;
  happeningNow?: boolean;
}) {
  const titleSponsor = curatedSponsorsFor(name)?.title ?? null;
  const blurb = (description ?? "").trim();
  const teaser = blurb.length > 170 ? `${blurb.slice(0, 170).trimEnd()}…` : blurb;
  const eyebrow = happeningNow
    ? "Happening now"
    : entered
      ? "You're entered · Your event"
      : "Coming up · Don't miss out";
  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border">
      <Link
        to="/my-events/$eventId"
        params={{ eventId }}
        className="block active:scale-[0.99] transition-transform"
      >
        <div
          {...brandHeader(heroColor)}
          className={`${brandHeader(heroColor).className} px-4 py-3 text-white`}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest opacity-85">
                {happeningNow ? (
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                ) : null}
                {eyebrow}
              </p>
              <p className="font-display text-lg font-bold leading-tight">{name}</p>
            </div>
            {titleSponsor ? (
              <div className="w-[112px] shrink-0 sm:w-[150px]">
                <div className="grid h-16 w-full place-items-center rounded-xl bg-white p-2 shadow-sm sm:h-20">
                  <img
                    src={titleSponsor.logoUrl}
                    alt={`${titleSponsor.name} — title sponsor`}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <p className="mt-1 text-center text-[8px] font-bold uppercase tracking-[0.16em] opacity-80">
                  Title sponsor
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-start gap-3 px-4 py-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-xl bg-secondary object-contain p-1 ring-1 ring-border"
            />
          ) : (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-cherry-deep">
              <CalendarDays className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {formatDate(date)} · <span className="text-cherry">{daysAway(date)}</span>
            </p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> {location}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              {entered
                ? teaser ||
                  "Everything you need for race weekend — schedule, routes, venue, packing list and your entry details."
                : teaser ||
                  "Riders are already locking in their spots. Read the route, venue and weekend plan before entries close."}
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-cherry">
              {entered ? "Open your event hub" : "Read about this event"}
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>

      {guest ? (
        <div className="grid grid-cols-4 gap-1 border-t border-border px-2 py-2">
          {[
            { label: "Schedule", icon: Calendar },
            { label: "Route", icon: Activity },
            { label: "Venue", icon: MapPin },
            { label: "Village", icon: Globe },
          ].map((q) => (
            <Link
              key={q.label}
              to="/my-events/$eventId"
              params={{ eventId }}
              className="flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold text-ink active:bg-secondary"
            >
              <q.icon className="h-4 w-4 text-cherry-deep" />
              {q.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}


function SportSection({
  title,
  icon: Icon,
  sport,
  events,
  collapsed = false,
  collapseHint,
}: {
  title: string;
  icon: typeof Bike;
  sport: "moto" | "mtb";
  events: Event[];
  collapsed?: boolean;
  collapseHint?: string;
}) {
  const [userExpanded, setUserExpanded] = useState(false);
  const showExpanded = !collapsed || userExpanded;
  const toggle = () => setUserExpanded((v) => !v);
  if (events.length === 0) return null;
  return (
    <section>
      <div className="flex items-baseline justify-between px-5 pb-2 pt-6">
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={showExpanded}
            className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-ink active:opacity-70 transition"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-cherry-deep">
              <Icon className="h-3.5 w-3.5" />
            </span>
            {title}
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${
                showExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
        ) : (
          <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-ink">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-cherry-deep">
              <Icon className="h-3.5 w-3.5" />
            </span>
            {title}
          </h2>
        )}
        <Link to="/events" search={{ sport }} className="text-xs font-semibold text-cherry">
          See all →
        </Link>

      </div>

      {/* Even when collapsed we still show the next couple of events so nothing
          disappears from the dashboard — the prompt just reveals the rest. */}
      {collapsed && !showExpanded && events.length > 2 ? (
        <button
          type="button"
          onClick={toggle}
          className="mx-5 mt-1 flex w-[calc(100%-2.5rem)] items-center justify-between gap-3 rounded-2xl bg-secondary/60 px-4 py-3 text-left ring-1 ring-border active:scale-[0.99] transition animate-fade-in"
        >
          <span className="flex items-center gap-2.5 text-sm text-ink-soft">
            <ChevronDown className="h-4 w-4 shrink-0 text-cherry-deep" />
            <span>
              <span className="font-semibold text-ink">Tap to expand</span>
              <span className="ml-1.5">{collapseHint ?? "view these events."}</span>
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-cherry-deep">
            +{events.length - 2}
          </span>
        </button>
      ) : null}

      {/* Smooth height + opacity animation for the event list */}
      <div className="overflow-hidden transition-[max-height,opacity] duration-300 ease-out">
        <ul className="space-y-2 px-5 pt-1">
          {(showExpanded ? events : events.slice(0, 2)).map((e) => (

            <li key={e.id}>
              <Link
                to="/my-events/$eventId"
                params={{ eventId: e.id }}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border active:scale-[0.99] transition-transform"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {e.logoUrl ? (
                    <img
                      src={e.logoUrl}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-xl bg-secondary object-contain p-1 ring-1 ring-border"
                    />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-cherry-deep">
                      <Icon className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-display text-[15px] font-bold text-ink">{e.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {formatDate(e.date)} · {e.location}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-cherry">{daysAway(e.date)}</span>
                      {e.status === "live" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-cherry px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
                          <span className="h-1 w-1 animate-pulse rounded-full bg-white" /> Live
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function daysAway(iso: string): string {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return "";
  const now = new Date();
  // Calendar-day difference, not 24h blocks: an event at 05:00 in two sleeps
  // must read "In 2 days", never "Tomorrow".
  const days = Math.round(
    (new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
  if (days < 0) return "Underway";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 31) return `In ${days} days`;
  const months = Math.round(days / 30);
  return `In ${months} month${months > 1 ? "s" : ""}`;
}


function NotificationsSheet({

  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: ReturnType<typeof useAdminStore.getState>["feed"];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full sm:max-w-md max-h-[80vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-card shadow-2xl ring-1 ring-border animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-cherry-deep" />
            <p className="font-display text-lg font-bold text-ink">Notifications</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3 space-y-2" style={{ maxHeight: "calc(80vh - 64px)" }}>
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-soft">You're all caught up.</p>
          ) : (
            items.map((p) => {
              const isOpen = expanded === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setExpanded(isOpen ? null : p.id)}
                  className="w-full text-left rounded-2xl bg-secondary/50 p-3 ring-1 ring-border transition hover:bg-secondary"
                >
                  <div className="flex items-center gap-2">
                    <TypeBadge type={p.type} />
                    <span className="text-[11px] text-muted-foreground">
                      {relativeTime(p.postedAt)}
                    </span>
                    {p.pinned ? (
                      <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-cherry-deep">
                        Pinned
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 font-display text-sm font-bold text-ink">{p.title}</p>
                  <p
                    className={`mt-1 text-sm text-ink-soft ${isOpen ? "" : "line-clamp-2"}`}
                  >
                    {p.body}
                  </p>
                  <p className="mt-1.5 text-[11px] font-semibold text-cherry-deep">
                    {isOpen ? "Show less" : "Read more"}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>
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
          <p className="mb-2 font-display text-lg font-bold tracking-tight text-ink">
            More events you are entered for
          </p>


          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {rest.map((r) => (
              <Link
                key={r.event_entrant_id}
                to="/my-events/$eventId"
                params={{ eventId: r.event_id }}
                style={brandHeader(r.event.hero_color).style}
                className={`snap-start shrink-0 w-56 rounded-2xl ${brandHeader(r.event.hero_color).className} p-3 text-white shadow-sm`}
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

function TitleSponsorBadge({
  name,
  logoUrl,
  url,
}: {
  name?: string;
  logoUrl?: string;
  url?: string;
}) {
  if (!logoUrl && !name?.trim()) return null;
  const inner = (
    <div className="flex flex-col items-end gap-1 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-black/10">
      <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink-soft">
        Title sponsor
      </span>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name ? `${name} logo` : "Title sponsor"}
          className="h-6 max-w-[112px] object-contain"
          loading="lazy"
        />
      ) : (
        <span className="text-xs font-bold text-ink">{name}</span>
      )}
    </div>
  );
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="shrink-0">
      {inner}
    </a>
  ) : (
    <div className="shrink-0">{inner}</div>
  );
}

function NextEventHero({ row }: { row: MyEventRow }) {
  const cd = countdownLabel(row.event.event_date);
  const date = new Date(row.event.event_date);
  return (
    <Link
      to="/my-events/$eventId"
      params={{ eventId: row.event_id }}
      style={brandHeader(row.event.hero_color).style}
      className={`block overflow-hidden rounded-3xl ${brandHeader(row.event.hero_color).className} p-5 text-white shadow-md ring-1 ring-black/5 active:scale-[0.99] transition`}
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

      {row.event.title_sponsor_logo_url || row.event.title_sponsor_name ? (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-md ring-1 ring-black/10">
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-soft">
            Title sponsor
          </span>
          {row.event.title_sponsor_logo_url ? (
            <img
              src={row.event.title_sponsor_logo_url}
              alt={row.event.title_sponsor_name ?? "Title sponsor"}
              className="h-14 w-full max-w-[260px] object-contain sm:h-16 sm:max-w-[320px]"
              loading="lazy"
            />
          ) : (
            <span className="text-center font-display text-lg font-black text-ink">
              {row.event.title_sponsor_name}
            </span>
          )}
        </div>
      ) : null}


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
        Open Adventure Awaits <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

const SOCIAL_ICONS: {
  key: string;
  label: string;
  icon: typeof Facebook;
}[] = [
  { key: "website", label: "Website", icon: Globe },
  { key: "facebook", label: "Facebook", icon: Facebook },
  { key: "instagram", label: "Instagram", icon: Instagram },
  { key: "twitter", label: "X", icon: Twitter },
  { key: "youtube", label: "YouTube", icon: Youtube },
  { key: "tiktok", label: "TikTok", icon: Music2 },
  { key: "strava", label: "Strava", icon: Activity },
];

function EventSocialRow({
  links,
  compact = false,
}: {
  links: Record<string, string> | null | undefined;
  compact?: boolean;
}) {
  const entries = SOCIAL_ICONS.filter((s) => {
    const url = links?.[s.key];
    return typeof url === "string" && url.trim().length > 0;
  });
  if (entries.length === 0) return null;
  const size = compact ? "h-6 w-6" : "h-8 w-8";
  const icon = compact ? "h-3 w-3" : "h-4 w-4";
  return (
    <div className={`${compact ? "mt-2" : "mt-3"} flex flex-wrap gap-1.5`}>
      {entries.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(links![key], "_blank", "noopener,noreferrer");
          }}
          aria-label={`Follow on ${label}`}
          title={label}
          className={`grid ${size} place-items-center rounded-full bg-white/20 text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/30`}
        >
          <Icon className={icon} strokeWidth={2.2} />
        </button>

      ))}
    </div>
  );
}
