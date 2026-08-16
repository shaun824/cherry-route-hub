import { entryNinjaRegistrationUrl } from "@/lib/entry-ninja-link";
import { WhatsappButton } from "@/components/whatsapp-button";
import { isBotMiss } from "@/lib/bot-handoff";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { askEventBot } from "@/lib/event-bot.functions";
import { fetchEventSponsors } from "@/lib/event-sponsors.functions";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { EventWeatherCard } from "@/components/event-weather";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  CheckSquare,
  Clock,
  Facebook,
  Globe,
  Info,
  Instagram,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Newspaper,
  Handshake,
  Tent,
  Pin,

  Phone,
  Send,
  Square,
  Twitter,
  Youtube,
  Music2,
  Activity,
  Map as MapIcon,
  Download,
  Mountain,
  Route as RouteIcon,
  Lock as LockIcon,

} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { VillageMapView } from "@/components/village-map-view";
import { OfflinePackCard } from "@/components/offline-pack-card";
import { buildPackingList, fetchEventInfo, tubelessSanitise, type EventInfoBlock, type PackingItem } from "@/lib/event-info";
import { getEventSport } from "@/lib/event-sport";
import { RouteMap } from "@/components/route-map";
import { RouteFileStats } from "@/components/route-file-stats";
import { RouteProfile } from "@/components/route-profile";

import { fetchMyRooming } from "@/lib/rooming";
import { SponsorScroller } from "@/components/sponsor-scroller";
import { eventPromosFor } from "@/lib/event-promos";
import { PromoCarousel } from "@/components/promo-carousel";
import { curatedSponsorsFor } from "@/lib/event-sponsor-overrides";
import { eventHasTshirt } from "@/lib/apparel";
import { useAdminStore } from "@/lib/store";
import { fetchMyEventById, type MyEventRow } from "@/lib/my-events";
import { groupExtras } from "@/lib/extras-display";
import { Printer, Shirt, Package, Siren, BedDouble, ExternalLink } from "lucide-react";
import type { EventDay, EventRoute, FeedPost, ScheduleItem, SocialLinks } from "@/lib/mock-data";
import { relativeTime } from "@/lib/mock-data";
import { TypeBadge } from "@/components/ui-bits";

import { TrackerPanel } from "@/components/tracker-panel";
import { LockedSection } from "@/components/locked-section";
import { buildMapEmbedSrc, buildMapLink, resolveVenuePoint } from "@/lib/map-embed";
import { VenueMiniMap } from "@/components/venue-mini-map";
import { PaymentStatusCard } from "@/components/payment-status-card";
import { brandHeader } from "@/lib/event-brand";
import { EventLogo } from "@/components/event-logo";
import { EventPhotosPanel } from "@/components/event-photos-panel";
import { FeedPostBody } from "@/components/feed-post-body";

import { Image as ImageIcon } from "lucide-react";


export const Route = createFileRoute("/my-events/$eventId")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("events")
      .select("id, name, discipline, event_date, location, map_query, distance_km, description, hero_color, logo_url, days, schedule, social_links, status, entry_ninja_url, website_url")
      .eq("id", params.eventId)
      .maybeSingle();
    if (error || !data) throw notFound();
    return { event: data };
  },
  head: ({ loaderData }) => {
    const ev = loaderData?.event;
    if (!ev) {
      return { meta: [{ title: "Event — Red Cherry Events" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${ev.name} — Red Cherry Events`;
    const description = `${ev.name} in ${ev.location}: schedule, routes, venue, packing list and event info.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: MyEventDetail,
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-ink-soft">
      Event not found.{" "}
      <Link to="/my-events" className="font-semibold text-cherry">
        Back
      </Link>
    </div>
  ),
});

/** Lets the accommodation card jump the page to the village tab, focused. */
const VillageFocusContext = createContext<(f: { zoneId?: string | null; spotId?: string | null; tentId?: string | null }) => void>(
  () => {},
);

type Tab = "info" | "village" | "routes" | "news" | "photos" | "chat" | "ask" | "packing" | "sponsors";

function MyEventDetail() {
  const { event } = Route.useLoaderData();
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>("info");
  const [villageFocus, setVillageFocus] = useState<{ zoneId?: string | null; spotId?: string | null; tentId?: string | null }>({});
  const focusVillage = useCallback((f: { zoneId?: string | null; spotId?: string | null; tentId?: string | null }) => {
    setVillageFocus(f);
    setTab("village");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const eventNews = useAdminStore((s) => s.feed).filter((p) => p.eventId === event.id);
  const hasFreshNews = eventNews.some(
    (p) => Date.now() - new Date(p.postedAt).getTime() < 7 * 24 * 60 * 60 * 1000,
  );



  return (
    <VillageFocusContext.Provider value={focusVillage}>
    <div>
      <div
        style={brandHeader(event.hero_color).style}
        className={`relative overflow-hidden ${brandHeader(event.hero_color).className} px-5 pb-5 pt-14 text-white`}
      >
        <Link
          to={user ? "/my-events" : "/events"}
          className="absolute left-4 top-10 grid h-9 w-9 place-items-center rounded-full bg-white/15"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest opacity-85">
              {event.discipline}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold leading-tight">{event.name}</h1>
            <p className="mt-2 text-xs opacity-90">
              {new Date(event.event_date).toLocaleString("en-ZA", {
                weekday: "long",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Africa/Johannesburg",
              })}
              {" · "}
              {event.location}
            </p>
          </div>
          <EventLogo src={event.logo_url} name={event.name} size="lg" onBrand />
        </div>
      </div>

      <nav className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border bg-card/95 px-2 py-2 backdrop-blur">
        {(
          [
            { id: "info", label: "Info", icon: Info },
            { id: "routes", label: "Routes", icon: MapIcon },
            { id: "village", label: "Village", icon: Tent },
            { id: "news", label: "News", icon: Newspaper },
            { id: "photos", label: "Photos", icon: ImageIcon },

            { id: "packing", label: "Packing", icon: CheckSquare },
            { id: "chat", label: "Event chat", icon: MessageCircle },
            { id: "ask", label: "Ask admin", icon: MessagesSquare },
            { id: "sponsors", label: "Sponsors", icon: Handshake },
          ] as { id: Tab; label: string; icon: typeof Info }[]
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                active ? "bg-cherry text-white" : "text-ink-soft"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {t.id === "news" && hasFreshNews && !active ? (
                <span className="absolute right-1.5 top-1 h-1.5 w-1.5 rounded-full bg-cherry" />
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4">
        {tab === "info" && (
          <div className="space-y-5">
            <section>
              <SectionTitle>Ask the assistant</SectionTitle>
              <div className="mt-2">
                <AskAdminPanel eventId={event.id} userId={user?.id ?? null} eventName={event.name} compact />
              </div>
            </section>
            <InfoPanel eventId={event.id} description={event.description} distanceKm={event.distance_km} event={event} isLive={event.status === "live"} eventName={event.name} />
          </div>
        )}
        {tab === "village" && (
          <section className="space-y-3">
            <SectionTitle>Race village</SectionTitle>
            <OfflinePackCard event={event as never} />
            <VillageMapView
              eventId={event.id}
              focusZoneId={villageFocus.zoneId ?? null}
              focusSpotId={villageFocus.spotId ?? null}
              focusTentId={villageFocus.tentId ?? null}
            />
          </section>
        )}
        {tab === "routes" && <RoutesPanel eventId={event.id} event={event} />}
        {tab === "news" && <EventNewsPanel posts={eventNews} />}
        {tab === "photos" && (
          <section className="space-y-3">
            <SectionTitle>Event photos</SectionTitle>
            <EventPhotosPanel eventId={event.id} />
          </section>
        )}

        {tab === "packing" && <PackingPanel eventId={event.id} userId={user?.id ?? null} event={event} />}
        {tab === "chat" && <ChatPanel eventId={event.id} userId={user?.id ?? null} />}
        {tab === "ask" && <AskAdminPanel eventId={event.id} userId={user?.id ?? null} eventName={event.name} />}
        {tab === "sponsors" && <EventSponsorsPanel eventId={event.id} eventName={event.name} />}

      </div>
    </div>
    </VillageFocusContext.Provider>
  );
}

function EventSponsorsPanel({ eventId, eventName }: { eventId: string; eventName?: string }) {
  const curated = curatedSponsorsFor(eventName);
  const load = useServerFn(fetchEventSponsors);
  const q = useQuery({
    queryKey: ["event-sponsors", eventId],
    queryFn: () => load({ data: { eventId } }),
    staleTime: 60 * 60 * 1000,
  });

  if (curated) {
    return (
      <div className="space-y-5">
        <div>
          <p className="mb-3 text-xs text-ink-soft">
            {curated.title.name} is the title sponsor. Tap a logo to visit their site.
          </p>
          <a
            href={curated.title.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
          >
            <div className="grid h-32 place-items-center rounded-2xl bg-white p-5 ring-1 ring-black/10 shadow-sm sm:h-40">
              <img
                src={curated.title.logoUrl}
                alt={curated.title.name}
                loading="lazy"
                className="max-h-20 max-w-full object-contain sm:max-h-24"
              />
            </div>
            <p className="mt-2 text-center text-[10px] uppercase tracking-[0.16em] text-ink-soft">
              Title sponsor
            </p>
          </a>
        </div>

        {curated.partners.length > 0 && (
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Partners
            </p>
            <div
              className={`grid w-full gap-3 ${
                curated.partners.length === 1
                  ? "grid-cols-1"
                  : curated.partners.length === 2
                    ? "grid-cols-2"
                    : curated.partners.length === 3
                      ? "grid-cols-1 sm:grid-cols-3"
                      : "grid-cols-2 sm:grid-cols-3"
              }`}
            >
              {curated.partners.map((s) => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="block"
                >
                  <div className="grid h-28 w-full place-items-center rounded-2xl bg-white p-3 ring-1 ring-black/10 shadow-sm sm:h-36">
                    <img
                      src={s.logoUrl}
                      alt={s.name}
                      loading="lazy"
                      className="max-h-18 w-full object-contain sm:max-h-24"
                    />
                  </div>
                  <p className="mt-2 text-center text-[10px] uppercase tracking-[0.16em] text-ink-soft">
                    {s.name}
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}


        {curated.supporters && curated.supporters.length > 0 && (
          <SponsorScroller
            title="Supported by"
            compact
            sponsors={curated.supporters.map((s) => ({ ...s, id: s.name }))}
          />
        )}
      </div>
    );
  }

  if (q.isLoading) {
    return <p className="py-8 text-center text-sm text-ink-soft">Loading sponsors…</p>;
  }

  const sponsors = q.data?.sponsors ?? [];
  if (sponsors.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-soft">
        No sponsors found for this event yet.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs text-ink-soft">
        Proudly supported by these partners. Tap a logo to visit their site.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {sponsors.map((s: { name: string; logoUrl: string; linkUrl: string | null }) => {
          const inner = (
            <div className="grid h-24 place-items-center rounded-2xl border border-border bg-card p-3">
              <img
                src={s.logoUrl}
                alt={s.name}
                loading="lazy"
                className="max-h-16 max-w-full object-contain"
              />
            </div>
          );
          return s.linkUrl ? (
            <a key={s.logoUrl} href={s.linkUrl} target="_blank" rel="noreferrer noopener">
              {inner}
            </a>
          ) : (
            <div key={s.logoUrl}>{inner}</div>
          );
        })}
      </div>
      {q.data?.source ? (
        <p className="mt-3 text-center text-[11px] text-ink-soft">
          Pulled from{" "}
          <a href={q.data.source} target="_blank" rel="noreferrer noopener" className="underline">
            the official event site
          </a>
        </p>
      ) : null}
    </div>
  );
}

function EventNewsPanel({ posts }: { posts: FeedPost[] }) {

  const now = Date.now();
  const sorted = posts
    .filter((p) => new Date(p.postedAt).getTime() <= now)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    });

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-6 text-center text-sm text-ink-soft ring-1 ring-border">
        No updates for this event yet.
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {sorted.map((p) => (
        <li
          key={p.id}
          className={`rounded-2xl p-4 ring-1 ${
            p.pinned ? "bg-amber-50 ring-amber-300/60" : "bg-card ring-border"
          }`}
        >
          <div className="flex items-center gap-2">
            <TypeBadge type={p.type} />
            {p.pinned ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900">
                <Pin className="h-3 w-3" /> Pinned
              </span>
            ) : null}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {relativeTime(p.postedAt)}
            </span>
          </div>
          <h3 className="mt-2 font-display text-base font-bold leading-snug text-ink">{p.title}</h3>
          <FeedPostBody post={p} />
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {p.author}
          </p>
        </li>
      ))}
    </ul>
  );
}

const DESCRIPTION_PREVIEW_LENGTH = 50;


function fileNameFromUrl(url: string, fallback: string) {
  try {
    const p = decodeURIComponent(new URL(url, "https://x.invalid").pathname);
    const last = p.split("/").filter(Boolean).pop();
    return last && /\.\w{2,4}$/.test(last) ? last : fallback;
  } catch {
    return fallback;
  }
}

function DownloadLink({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      download={label}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-semibold text-white"
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

function RoutesPanel({
  eventId,
  event,
}: {
  eventId: string;
  event: { days?: unknown };
}) {
  const { user, loading } = useSession();
  const locked = !loading && !user;
  // Route files are for entered riders only.
  const entryQ = useQuery({
    queryKey: ["my-event", eventId],
    queryFn: () => fetchMyEventById(eventId),
    enabled: !!user,
  });
  const isEntrant = !!entryQ.data;
  const downloadsLocked = locked || (!!user && !entryQ.isLoading && !isEntrant);
  const days: EventDay[] = Array.isArray(event.days) ? (event.days as EventDay[]) : [];
  const allRoutes = days.flatMap((d) => d.routes ?? []);
  const hasMap = allRoutes.some((r) => (r.kmlUrls ?? []).length > 0);


  if (allRoutes.length === 0) {
    return <EmptyBlock>Routes for this event will be published here soon.</EmptyBlock>;
  }

  return (
    <div className="space-y-5">
      {hasMap ? (
        <section>
          <SectionTitle>Interactive map</SectionTitle>
          <div className="mt-2 mb-3">
            <OfflinePackCard event={event as never} />
          </div>
          <div className="mt-2">
            <LockedSection locked={locked} message="Sign in to view the interactive route map">
              <RouteMap event={event as never} height="320px" />
            </LockedSection>
            {!locked ? (
              <Link
                to="/events/$eventId/map"
                params={{ eventId }}
                className="mt-2 inline-block text-[11px] font-semibold text-cherry"
              >
                Open fullscreen map →
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {days.map((day, di) => {
        const routes = day.routes ?? [];
        if (routes.length === 0) return null;
        return (
          <section key={day.id || di}>
            <SectionTitle>
              {day.label || (day.date ? new Date(day.date).toDateString() : `Day ${di + 1}`)}
            </SectionTitle>
            <ul className="mt-2 space-y-3">
              {routes.map((r: EventRoute, ri) => {
                const kmls = r.kmlUrls ?? [];
                return (
                  <li key={r.id || ri} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                        style={{ backgroundColor: r.color || "#b91c1c" }}
                      >
                        <RouteIcon className="h-3 w-3" />
                        {r.tier}
                      </span>
                      <p className="text-sm font-semibold text-ink">{r.name}</p>
                    </div>
                    <RouteFileStats route={r} />
                    <RouteProfile route={r} color={r.color} />

                    {r.description ? (
                      <p className="mt-2 text-xs leading-relaxed text-ink-soft">{r.description}</p>
                    ) : null}
                    {kmls.length > 0 || r.gpxUrl ? (
                      downloadsLocked && !locked ? (
                        <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-muted/60 px-3 py-2 text-[11px] font-medium text-ink-soft">
                          <LockIcon className="h-3.5 w-3.5 text-cherry" />
                          Route files are available to entered riders only.
                        </p>
                      ) : (
                        <LockedSection locked={locked} message="Sign in to download route files">
                          <div className="mt-3 flex flex-wrap gap-2">
                            {kmls.map((u, i) => (
                              <DownloadLink
                                key={u}
                                url={u}
                                label={fileNameFromUrl(
                                  u,
                                  `${r.name || "route"}${kmls.length > 1 ? `-${i + 1}` : ""}.kml`,
                                )}
                              />
                            ))}
                            {r.gpxUrl ? (
                              <DownloadLink
                                url={r.gpxUrl}
                                label={fileNameFromUrl(r.gpxUrl, `${r.name || "route"}.gpx`)}
                              />
                            ) : null}
                          </div>
                        </LockedSection>
                      )
                    ) : (
                      <p className="mt-3 text-[11px] text-muted-foreground">
                        No route file uploaded yet.
                      </p>
                    )}

                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function InfoPanel({
  eventId,
  description,
  distanceKm: _distanceKm,
  event,
  isLive,
  eventName,
}: {
  eventId: string;
  description: string | null;
  distanceKm: number;
  event: { days?: unknown; schedule?: unknown; location?: string | null; map_query?: string | null; social_links?: unknown; entry_ninja_url?: string | null; website_url?: string | null; event_date?: string | null };
  isLive: boolean;
  eventName: string;
}) {
  // Weather is only worth showing (and refreshing) inside the forecast window.
  const daysToEvent = event.event_date
    ? Math.ceil((new Date(event.event_date).getTime() - Date.now()) / 86_400_000)
    : null;
  const showWeather =
    daysToEvent !== null && daysToEvent <= 10 && daysToEvent >= -1 && Boolean(event.location);
  const q = useQuery({ queryKey: ["event-info", eventId], queryFn: () => fetchEventInfo(eventId) });
  const info = q.data;
  const days: EventDay[] = Array.isArray(event.days) ? (event.days as EventDay[]) : [];
  
  const schedule: ScheduleItem[] = Array.isArray(event.schedule) ? (event.schedule as ScheduleItem[]) : [];

  const aboutText = description ?? "";
  const isLongAbout = aboutText.length > DESCRIPTION_PREVIEW_LENGTH;
  const [aboutExpanded, setAboutExpanded] = useState(false);

  return (
    <div className="space-y-4">
      {isLive ? (
        <section>
          <SectionTitle>Live tracking & SOS</SectionTitle>
          <div className="mt-2">
            <TrackerPanel eventName={eventName} />
          </div>
        </section>
      ) : (
        <div className="flex items-start gap-2 rounded-2xl bg-card p-3 text-xs text-ink-soft ring-1 ring-border">
          <Siren className="mt-0.5 h-4 w-4 shrink-0 text-cherry" />
          <p>Live tracking and SOS activate on race day, once this event goes live.</p>
        </div>
      )}

      {showWeather ? (
        <EventWeatherCard
          eventName={eventName}
          location={event.location ?? ""}
          mapQuery={event.map_query}
          eventDate={event.event_date ?? undefined}
        />
      ) : null}

      <YourEntryCard
        eventId={eventId}
        entryUrl={event.entry_ninja_url ?? event.website_url ?? null}
      />

      {eventPromosFor(eventName).length > 0 ? (
        <section>
          <SectionTitle>Rider offers</SectionTitle>
          <div className="mt-2">
            <PromoCarousel promos={eventPromosFor(eventName)} />
          </div>
        </section>
      ) : null}



      {aboutText ? (
        <section>
          <SectionTitle>About</SectionTitle>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            {isLongAbout && !aboutExpanded
              ? `${aboutText.slice(0, DESCRIPTION_PREVIEW_LENGTH).trimEnd()}…`
              : aboutText}
          </p>
          {isLongAbout ? (
            <button
              type="button"
              onClick={() => setAboutExpanded((v) => !v)}
              className="mt-2 text-xs font-semibold text-cherry"
            >
              {aboutExpanded ? "Show less" : "Learn more"}
            </button>
          ) : null}
        </section>
      ) : null}

      {schedule.length > 0 ? (
        <section>
          <SectionTitle>Schedule</SectionTitle>
          <ScheduleView schedule={schedule} days={days} />
        </section>
      ) : null}

      {days.some((d) => (d.routes ?? []).length > 0) ? (
        <section>
          <SectionTitle>Routes</SectionTitle>
          <div className="mt-2">
            <RoutesPanel eventId={eventId} event={event} />
          </div>
        </section>
      ) : null}


      <section>
        <SectionTitle>Venue</SectionTitle>
        {(() => {
          const venue =
            info?.venue_address ||
            event.map_query ||
            event.location ||
            "";

          const embedSrc = buildMapEmbedSrc({
            mapUrl: info?.map_embed_url,
            lat: info?.venue_lat,
            lng: info?.venue_lng,
            address: venue,
          });
          const venuePoint = resolveVenuePoint({
            mapUrl: info?.map_embed_url,
            lat: info?.venue_lat,
            lng: info?.venue_lng,
          });
          if (!venue && !embedSrc) return <EmptyBlock>Venue details will appear here.</EmptyBlock>;
          const mapLink =
            buildMapLink({
              mapUrl: info?.map_embed_url,
              lat: info?.venue_lat,
              lng: info?.venue_lng,
              address: venue,
            }) ?? "https://www.google.com/maps";
          return (
            <div className="mt-2 overflow-hidden rounded-xl bg-card ring-1 ring-border">
              <a
                href={mapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
                aria-label="Open venue in Google Maps"
              >
                {venuePoint ? (
                  <div className="pointer-events-none h-44 w-full">
                    <VenueMiniMap lat={venuePoint.lat} lng={venuePoint.lng} height="176px" />
                  </div>
                ) : embedSrc ? (
                  <iframe
                    title="Venue map"
                    src={embedSrc}
                    className="pointer-events-none h-44 w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : null}
              </a>
              <div className="p-3">
                <p className="flex items-start gap-2 text-sm font-semibold text-ink">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cherry" />
                  {venue}
                </p>
                {info?.parking_notes ? (
                  <p className="mt-2 text-xs text-ink-soft">{info.parking_notes}</p>
                ) : null}
                <a
                  href={mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Navigate in Google Maps ↗
                </a>
              </div>
            </div>
          );
        })()}
      </section>


      <section className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card p-3 ring-1 ring-border">
        <p className="min-w-0 flex-1 text-xs text-ink-soft">
          Can&apos;t find what you need? Message the Red Cherry team directly.
        </p>
        <WhatsappButton size="sm" context={eventName} />
      </section>

      <FollowSection links={(event.social_links as SocialLinks | null) ?? undefined} />


      <SponsorsBlock eventName={eventName} />


      {info?.rules_md ? (
        <section>
          <SectionTitle>Rules</SectionTitle>
          <p className="mt-1.5 whitespace-pre-line rounded-xl bg-card p-3 text-sm text-ink-soft ring-1 ring-border">
            {info.rules_md}
          </p>
        </section>
      ) : null}

      {info?.faqs && info.faqs.length > 0 ? (
        <section>
          <SectionTitle>FAQs</SectionTitle>
          <ul className="mt-2 space-y-2">
            {info.faqs.map((f, i) => (
              <li key={i} className="rounded-xl bg-card p-3 ring-1 ring-border">
                <p className="text-sm font-semibold text-ink">{f.q}</p>
                <p className="mt-1 whitespace-pre-line text-xs text-ink-soft">{f.a}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {info?.emergency_contacts && info.emergency_contacts.length > 0 ? (
        <section>
          <SectionTitle>Emergency contacts</SectionTitle>
          <ul className="mt-2 space-y-2">
            {info.emergency_contacts.map((c, i) => (
              <li key={i}>
                <a
                  href={`tel:${c.phone}`}
                  className="flex items-center justify-between rounded-xl bg-card p-3 ring-1 ring-border"
                >
                  <span className="text-sm font-semibold text-ink">{c.label}</span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-cherry">
                    <Phone className="h-3.5 w-3.5" /> {c.phone}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PackingPanel({
  eventId,
  userId,
  event,
}: {
  eventId: string;
  userId: string | null;
  event: { days?: unknown; discipline?: string | null; name?: string | null };
}) {
  const q = useQuery({ queryKey: ["event-info", eventId], queryFn: () => fetchEventInfo(eventId) });
  const configured = q.data?.packing_list ?? [];

  // Size the list to the itinerary: ride days come from days that have routes,
  // nights from the number of days on the programme.
  const { rideDays, nights } = useMemo(() => {
    const days: EventDay[] = Array.isArray(event.days) ? (event.days as EventDay[]) : [];
    const withRoutes = days.filter((d) => (d.routes ?? []).length > 0).length;
    return {
      rideDays: withRoutes > 0 ? withRoutes : Math.max(1, days.length),
      nights: Math.max(0, days.length - 1),
    };
  }, [event.days]);

  const items: PackingItem[] = useMemo(() => {
    if (configured.length > 0) return tubelessSanitise(configured);
    return buildPackingList({
      rideDays,
      nights,
      sport: getEventSport(event.discipline, event.name),
    });
  }, [configured, rideDays, nights, event.discipline, event.name]);
  const usingDefault = configured.length === 0;


  const stateQ = useQuery({
    queryKey: ["packing-state", eventId, userId],
    queryFn: async () => {
      if (!userId) return {} as Record<string, boolean>;
      const { data } = await supabase
        .from("packing_checklist_state")
        .select("item_key, checked")
        .eq("event_id", eventId)
        .eq("user_id", userId);
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((r) => (map[r.item_key] = r.checked));
      return map;
    },
    enabled: Boolean(userId),
  });
  const qc = useQueryClient();

  async function toggle(key: string) {
    if (!userId) return;
    const current = Boolean(stateQ.data?.[key]);
    qc.setQueryData(["packing-state", eventId, userId], {
      ...(stateQ.data ?? {}),
      [key]: !current,
    });
    await supabase.from("packing_checklist_state").upsert({
      user_id: userId,
      event_id: eventId,
      item_key: key,
      checked: !current,
    });
  }

  // Group by category, preserving first-seen order.
  const groups = useMemo(() => {
    const map = new Map<string, PackingItem[]>();
    for (const it of items) {
      const cat = it.category ?? "Checklist";
      const arr = map.get(cat) ?? [];
      arr.push(it);
      map.set(cat, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  const total = items.length;
  const done = items.filter((i) => stateQ.data?.[i.key]).length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-card p-3 ring-1 ring-border">
        <div className="flex items-center justify-between text-xs text-ink-soft">
          <span className="font-semibold text-ink">Packed {done} / {total}</span>
          {usingDefault ? (
            <span className="rounded bg-cherry/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cherry-deep">
              Suggested
            </span>
          ) : null}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full cherry-gradient transition-all"
            style={{ width: total > 0 ? `${(done / total) * 100}%` : "0%" }}
          />
        </div>
        {usingDefault ? (
          <p className="mt-2 text-[11px] text-ink-soft">
            Sized for this event: {rideDays} riding day{rideDays > 1 ? "s" : ""}
            {nights > 0 ? ` and ${nights} night${nights > 1 ? "s" : ""} away` : " (no overnight stay)"}. Everyone
            runs tubeless — bring a spare tyre, sealant and plugs instead of tubes.
          </p>
        ) : null}

      </div>

      {groups.map(([cat, list]) => (
        <section key={cat}>
          <SectionTitle>{cat}</SectionTitle>
          <ul className="mt-2 space-y-2">
            {list.map((item) => {
              const checked = Boolean(stateQ.data?.[item.key]);
              return (
                <li key={item.key}>
                  <button
                    onClick={() => toggle(item.key)}
                    disabled={!userId}
                    className="flex w-full items-center gap-3 rounded-xl bg-card p-3 text-left ring-1 ring-border disabled:opacity-70"
                  >
                    {checked ? (
                      <CheckSquare className="h-5 w-5 text-cherry" />
                    ) : (
                      <Square className="h-5 w-5 text-ink-soft" />
                    )}
                    <span
                      className={`flex-1 text-sm ${checked ? "text-ink-soft line-through" : "font-semibold text-ink"}`}
                    >
                      {item.label}
                    </span>
                    {item.essential ? (
                      <span className="rounded bg-cherry/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cherry-deep">
                        Essential
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {!userId ? (
        <EmptyBlock>Sign in to save your progress across devices.</EmptyBlock>
      ) : null}
    </div>
  );
}

function ScheduleView({ schedule, days }: { schedule: ScheduleItem[]; days: EventDay[] }) {
  const grouped = useMemo(() => {
    // Group items by dayId, preserving order of days when known.
    const byDay = new Map<string, ScheduleItem[]>();
    for (const item of schedule) {
      const key = item.dayId ?? "__unscheduled__";
      const arr = byDay.get(key) ?? [];
      arr.push(item);
      byDay.set(key, arr);
    }
    const sortByTime = (a: ScheduleItem, b: ScheduleItem) => (a.time ?? "").localeCompare(b.time ?? "");
    const orderedDays = days.map((d) => ({
      day: d,
      items: (byDay.get(d.id) ?? []).slice().sort(sortByTime),
    }));
    const orphaned = (byDay.get("__unscheduled__") ?? []).slice().sort(sortByTime);
    // Also include day groups referenced but not in `days` (safety).
    const known = new Set(days.map((d) => d.id));
    const extras: { day: EventDay; items: ScheduleItem[] }[] = [];
    for (const [k, v] of byDay.entries()) {
      if (k === "__unscheduled__") continue;
      if (!known.has(k)) extras.push({ day: { id: k, date: "", routes: [] }, items: v.slice().sort(sortByTime) });
    }
    return { orderedDays: [...orderedDays, ...extras], orphaned };
  }, [schedule, days]);

  const dayLabel = (d: EventDay, index: number) => {
    if (d.label) return d.label;
    if (d.date) {
      const dt = new Date(d.date);
      if (!Number.isNaN(dt.getTime())) {
        return `Day ${index + 1} · ${dt.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}`;
      }
    }
    return `Day ${index + 1}`;
  };

  const tabs = useMemo(() => {
    const dayTabs = grouped.orderedDays
      .filter(({ items }) => items.length > 0)
      .map(({ day, items }, i) => ({ id: day.id, label: dayLabel(day, i), items }));
    if (grouped.orphaned.length > 0) {
      dayTabs.push({
        id: "__orphaned__",
        label: "General",
        items: grouped.orphaned,
      } as typeof dayTabs[number]);
    }
    return dayTabs;
  }, [grouped]);

  const [activeId, setActiveId] = useState<string | undefined>(tabs[0]?.id);
  useEffect(() => {
    if (!tabs.some((t) => t.id === activeId)) setActiveId(tabs[0]?.id);
  }, [tabs, activeId]);

  const active = tabs.find((t) => t.id === activeId);
  if (tabs.length === 0) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map((t) => {
          const isActive = t.id === activeId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveId(t.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ring-1 ${
                isActive
                  ? "bg-cherry text-white ring-cherry shadow-sm"
                  : "bg-card text-ink-soft ring-border hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {active ? (
        <div key={active.id} className="mt-3 rounded-xl bg-card p-3 ring-1 ring-border animate-fade-in">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <CalendarDays className="h-4 w-4 text-cherry" />
            {active.label}
          </p>
          <ul className="mt-2 space-y-2">
            {active.items.map((it, idx) => (
              <li key={`${it.time}-${idx}`} className="flex gap-3">
                <span className="flex w-16 shrink-0 items-start gap-1 text-xs font-bold text-cherry-deep">
                  <Clock className="mt-0.5 h-3 w-3" />
                  {it.time || "—"}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink">{it.label}</p>
                  {it.details ? (
                    <p className="mt-0.5 whitespace-pre-line text-xs text-ink-soft">{it.details}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ChatPanel({ eventId, userId }: { eventId: string; userId: string | null }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const q = useQuery({
    queryKey: ["event-chat", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_chat_messages")
        .select("id, event_id, author_id, body, created_at, profiles:profiles(full_name)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`chat-${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_chat_messages", filter: `event_id=eq.${eventId}` },
        () => qc.invalidateQueries({ queryKey: ["event-chat", eventId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [eventId, qc]);

  // Always open/settle at the newest message.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [q.data]);

  async function send() {
    if (!text.trim() || !userId) return;
    setBusy(true);
    const body = text.trim();
    setText("");
    const { error } = await supabase
      .from("event_chat_messages")
      .insert({ event_id: eventId, author_id: userId, body });
    if (error) console.warn(error);
    setBusy(false);
  }

  return (
    <div className="flex h-[60vh] flex-col rounded-2xl bg-card ring-1 ring-border">
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto overscroll-y-auto p-3 [touch-action:pan-y]"
      >
        {(q.data ?? []).length === 0 ? (
          <p className="mt-6 text-center text-xs text-ink-soft">
            No messages yet. Say hi to your fellow riders 👋
          </p>
        ) : (
          <ul className="space-y-2">
            {(q.data ?? []).map((m: any) => {
              const mine = m.author_id === userId;
              const name = m.profiles?.full_name ?? "Rider";
              return (
                <li
                  key={m.id}
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "ml-auto bg-cherry text-white" : "bg-secondary text-ink"
                  }`}
                >
                  {!mine && (
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                      {name}
                    </p>
                  )}
                  <p className="whitespace-pre-line">{m.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Message the group…"
          maxLength={1000}
          className="flex-1 rounded-lg bg-background px-3 py-2 text-sm ring-1 ring-border focus:outline-none focus:ring-cherry"
        />
        <button
          onClick={() => void send()}
          disabled={busy || !text.trim()}
          className="grid h-9 w-9 place-items-center rounded-full cherry-gradient text-white disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AskAdminPanel({
  eventId,
  userId,
  eventName,
  compact = false,
}: {
  eventId: string;
  userId: string | null;
  eventName?: string;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const qaListRef = useRef<HTMLDivElement>(null);



  const threadQ = useQuery({
    queryKey: ["qa-thread", eventId, userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("admin_qa_threads")
        .select("id")
        .eq("event_id", eventId)
        .eq("rider_user_id", userId)
        .maybeSingle();
      return data ?? null;
    },
    enabled: Boolean(userId),
  });

  const messagesQ = useQuery({
    queryKey: ["qa-messages", threadQ.data?.id],
    queryFn: async () => {
      if (!threadQ.data?.id) return [];
      const { data } = await supabase
        .from("admin_qa_messages")
        .select("id, author_id, body, is_admin_msg, is_bot, created_at")
        .eq("thread_id", threadQ.data.id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: Boolean(threadQ.data?.id),
  });

  useEffect(() => {
    if (!threadQ.data?.id) return;
    const ch = supabase
      .channel(`qa-${threadQ.data.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_qa_messages", filter: `thread_id=eq.${threadQ.data.id}` },
        () => qc.invalidateQueries({ queryKey: ["qa-messages", threadQ.data?.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [threadQ.data?.id, qc]);

  const askBot = useServerFn(askEventBot);

  async function send() {
    if (!text.trim() || !userId) return;
    setBusy(true);
    const body = text.trim();
    setText("");
    try {
      await askBot({ data: { eventId, question: body } });
      qc.invalidateQueries({ queryKey: ["qa-thread", eventId, userId] });
      qc.invalidateQueries({ queryKey: ["qa-messages", threadQ.data?.id] });
    } catch (err) {
      console.error("askEventBot failed", err);
      // Fallback: post the question directly so the admin still sees it.
      let threadId = threadQ.data?.id;
      if (!threadId) {
        const { data } = await supabase
          .from("admin_qa_threads")
          .insert({ event_id: eventId, rider_user_id: userId })
          .select("id")
          .single();
        threadId = data?.id;
        qc.invalidateQueries({ queryKey: ["qa-thread", eventId, userId] });
      }
      if (threadId) {
        await supabase.from("admin_qa_messages").insert({
          thread_id: threadId,
          author_id: userId,
          body,
          is_admin_msg: false,
        });
        await supabase
          .from("admin_qa_threads")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", threadId);
        qc.invalidateQueries({ queryKey: ["qa-messages", threadId] });
      }
    } finally {
      setBusy(false);
    }
  }

  // Offer the WhatsApp handoff once the assistant has admitted it can't answer
  // and no admin has replied since.
  const msgs = (messagesQ.data ?? []) as any[];
  const lastMiss = [...msgs].reverse().find((m) => m.is_bot || m.is_admin_msg);
  const stuck = Boolean(lastMiss?.is_bot && isBotMiss(lastMiss.body));
  const lastQuestion = [...msgs].reverse().find((m) => !m.is_bot && !m.is_admin_msg)?.body as
    | string
    | undefined;
  const waContext = [eventName, lastQuestion ? `— my question: "${lastQuestion.slice(0, 160)}"` : ""]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <div className={`flex ${compact ? "max-h-[46vh] min-h-[220px]" : "h-[60vh]"} flex-col rounded-2xl bg-card ring-1 ring-border`}>
      <div className="border-b border-border p-3 text-xs text-ink-soft">
        {compact
          ? "Got a question about this event? Ask our assistant bot 🍒 — it answers from the event details & website, and loops in a Red Cherry admin if it isn't sure."
          : "Ask anything about this event — our assistant bot 🍒 answers instantly from the event details & website, and loops in a Red Cherry admin when it isn't sure."}
      </div>

      <div
        ref={qaListRef}
        className="flex-1 overflow-y-auto overscroll-y-auto p-3 [touch-action:pan-y]"
      >
        {(messagesQ.data ?? []).length === 0 ? (
          <p className="mt-6 text-center text-xs text-ink-soft">
            {userId
              ? "No messages yet. Ask a question below and the bot will try first."
              : "Sign in to ask the assistant about this event."}
          </p>
        ) : (
          <ul className="space-y-2">
            {(messagesQ.data ?? []).map((m: any) => {
              const mine = m.author_id === userId && !m.is_bot;
              const isBot = Boolean(m.is_bot);
              const bubbleCls = mine
                ? "ml-auto bg-cherry text-white"
                : isBot
                  ? "bg-sky-100 text-sky-950 ring-1 ring-sky-200"
                  : "bg-emerald-100 text-emerald-950";
              const label = isBot ? "🍒 Assistant bot" : "Red Cherry admin";
              return (
                <li key={m.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${bubbleCls}`}>
                  {!mine && (
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                      {label}
                    </p>
                  )}
                  <p className="whitespace-pre-line">{m.body}</p>
                </li>
              );
            })}
            {busy && (
              <li className="max-w-[80%] rounded-2xl bg-sky-100 px-3 py-2 text-sm text-sky-950 ring-1 ring-sky-200">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                  🍒 Assistant bot
                </p>
                <p className="italic opacity-70">Thinking…</p>
              </li>
            )}
            {!busy && stuck ? (
              <li className="rounded-2xl border border-dashed border-[#25D366]/50 bg-[#25D366]/10 p-3">
                <p className="text-xs font-semibold text-ink">Still stuck?</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">
                  An admin will reply here, but you can also chat to us directly on WhatsApp for a
                  faster answer.
                </p>
                <WhatsappButton className="mt-2" size="sm" context={waContext} />
              </li>
            ) : null}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={userId ? "Ask about schedule, packing, venue…" : "Sign in to ask a question"}
          maxLength={1000}
          disabled={!userId}
          className="flex-1 rounded-lg bg-background px-3 py-2 text-sm ring-1 ring-border focus:outline-none focus:ring-cherry disabled:opacity-60"
        />
        <button
          onClick={() => void send()}
          disabled={busy || !text.trim() || !userId}
          className="grid h-9 w-9 place-items-center rounded-full cherry-gradient text-white disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[11px] font-bold uppercase tracking-wider text-ink-soft">
      {children}
    </h2>
  );
}

function EmptyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 rounded-xl border border-dashed border-border p-4 text-center text-xs text-ink-soft">
      {children}
    </div>
  );
}

const SOCIAL_META: {
  key: keyof SocialLinks;
  label: string;
  icon: typeof Facebook;
  color: string;
}[] = [
  { key: "website", label: "Website", icon: Globe, color: "bg-ink text-white" },
  { key: "facebook", label: "Facebook", icon: Facebook, color: "bg-[#1877F2] text-white" },
  { key: "instagram", label: "Instagram", icon: Instagram, color: "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white" },
  { key: "twitter", label: "X", icon: Twitter, color: "bg-black text-white" },
  { key: "youtube", label: "YouTube", icon: Youtube, color: "bg-[#FF0000] text-white" },
  { key: "tiktok", label: "TikTok", icon: Music2, color: "bg-black text-white" },
  { key: "strava", label: "Strava", icon: Activity, color: "bg-[#FC4C02] text-white" },
];

function FollowSection({ links }: { links?: SocialLinks }) {
  const entries = SOCIAL_META.filter((m) => Boolean(links?.[m.key]));
  if (entries.length === 0) return null;
  return (
    <section>
      <SectionTitle>Follow this event</SectionTitle>
      <div className="mt-2 flex flex-wrap gap-2">
        {entries.map(({ key, label, icon: Icon, color }) => (
          <a
            key={key}
            href={links![key]!}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${color}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </a>
        ))}
      </div>
    </section>
  );
}

function SponsorsBlock({ eventName }: { eventName?: string }) {
  const curated = curatedSponsorsFor(eventName);
  const sponsors = useAdminStore((s) => s.sponsors).filter((sp) => sp.active);

  if (curated) {
    return (
      <section aria-label="Sponsors" className="pt-2">
        <SectionTitle>Proudly supported by</SectionTitle>

        <div className="mt-2 grid place-items-center rounded-2xl bg-white p-5 ring-1 ring-black/10">
          <a
            href={curated.title.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            aria-label={`Visit ${curated.title.name}`}
          >
            <img
              src={curated.title.logoUrl}
              alt={curated.title.name}
              className="max-h-16 max-w-[260px] object-contain"
              loading="lazy"
            />
          </a>
        </div>
        <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft">
          Title sponsor · {curated.title.name}
        </p>

        <div className="mt-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft">
            Our partners
          </p>
          <div
            className={`grid w-full gap-2 sm:gap-3 ${
              curated.partners.length === 1
                ? "grid-cols-1"
                : curated.partners.length === 2
                  ? "grid-cols-2"
                  : curated.partners.length === 3
                    ? "grid-cols-1 sm:grid-cols-3"
                    : "grid-cols-2 sm:grid-cols-3"
            }`}
          >
            {curated.partners.map((sp) => (
              <a
                key={sp.name}
                href={sp.url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                title={sp.name}
                className="grid h-24 w-full place-items-center rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/10 sm:h-28"
              >
                <img
                  src={sp.logoUrl}
                  alt={sp.name}
                  className="max-h-16 w-full object-contain sm:max-h-20"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        </div>



        {curated.supporters && curated.supporters.length > 0 ? (
          <div className="mt-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft">
              Supported by
            </p>
            <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
              <ul
                className="flex w-max items-center gap-3 animate-marquee-reverse will-change-transform hover:[animation-play-state:paused]"
                style={{ animationDuration: `${Math.max(24, curated.supporters.length * 5)}s` }}
              >
                {[...curated.supporters, ...curated.supporters].map((sp, i) => (
                  <li key={`${sp.name}-${i}`}>
                    <a
                      href={sp.url}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      title={sp.name}
                      className="grid h-14 min-w-[130px] place-items-center rounded-xl bg-white px-4 shadow-sm ring-1 ring-black/10"
                    >
                      <img
                        src={sp.logoUrl}
                        alt={sp.name}
                        className="max-h-9 max-w-[110px] object-contain"
                        loading="lazy"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  if (sponsors.length === 0) return null;
  const primary = sponsors.find((sp) => sp.tier === "Platinum") ?? sponsors[0];
  const secondary = sponsors.filter((sp) => sp.id !== primary.id);

  const primaryInner = primary.logoUrl ? (
    <img src={primary.logoUrl} alt={primary.name} className="max-h-16 max-w-[220px] object-contain" loading="lazy" />
  ) : (
    <span className="font-display text-lg font-black tracking-[0.18em] text-white" style={{ textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>
      {primary.logoText || primary.name}
    </span>
  );

  return (
    <section aria-label="Sponsors" className="pt-2">
      <SectionTitle>Proudly supported by</SectionTitle>

      <div
        className="mt-2 grid place-items-center rounded-2xl p-5 ring-1 ring-border"
        style={{ background: primary.logoUrl ? "white" : primary.accent }}
      >
        {primary.url ? (
          <a href={primary.url} target="_blank" rel="noopener noreferrer sponsored" aria-label={`Visit ${primary.name}`}>
            {primaryInner}
          </a>
        ) : (
          primaryInner
        )}
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft">
          Headline sponsor · {primary.name}
        </p>
      </div>

      {secondary.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft">
            Our partners
          </p>
          <SponsorScroller title="" compact />
        </div>
      ) : null}
    </section>
  );
}



function EnterEventCta({ entryUrl }: { entryUrl: string | null }) {
  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft">Not entered yet</p>
      <p className="mt-0.5 font-display text-base font-bold text-ink">Enter this event</p>
      <p className="mt-1 text-xs text-ink-soft">
        Secure your spot on Entry Ninja — your entry details then appear here automatically.
      </p>
      <a
        href={entryUrl ?? "https://entries.redcherryevents.co.za/"}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl cherry-gradient py-3 text-sm font-bold text-white shadow-md shadow-cherry/25"
      >
        Enter on Entry Ninja <ExternalLink className="h-4 w-4" />
      </a>
    </section>
  );
}

function YourEntryCard({ eventId, entryUrl = null }: { eventId: string; entryUrl?: string | null }) {
  const { user, loading: sessionLoading } = useSession();
  const signedIn = Boolean(user);
  const q = useQuery({
    queryKey: ["my-entry", eventId],
    queryFn: () => fetchMyEventById(eventId),
    staleTime: 30_000,
    enabled: signedIn,
  });
  const roomingQ = useQuery({
    queryKey: ["my-rooming", eventId],
    queryFn: () => fetchMyRooming(eventId),
    staleTime: 30_000,
    enabled: signedIn,
  });
  const rooming = roomingQ.data ?? null;
  const focusVillage = useContext(VillageFocusContext);

  if (!signedIn) {
    if (sessionLoading) return <div className="h-32 animate-pulse rounded-2xl bg-secondary" />;
    return (
      <div className="space-y-2">
      <LockedSection locked message="Sign in to see your entry, sizes, merchandise and tent number">
        <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft">
            Your entry
          </p>
          <p className="mt-0.5 font-display text-base font-bold text-ink">
            Everything Red Cherry has on file for you
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
            <span className="rounded bg-accent px-2 py-0.5 text-cherry-deep">Category</span>
            <span className="rounded bg-accent px-2 py-0.5 text-cherry-deep">Batch</span>
            <span className="rounded bg-ink px-2 py-0.5 text-white">Bib</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="h-14 rounded-xl bg-secondary" />
            <div className="h-14 rounded-xl bg-secondary" />
          </div>
          <div className="mt-3 h-16 rounded-xl bg-secondary/60" />
        </section>
      </LockedSection>
      <EnterEventCta entryUrl={entryUrl} />
      </div>
    );
  }

  if (q.isLoading) {
    return <div className="h-32 animate-pulse rounded-2xl bg-secondary" />;
  }
  const row: MyEventRow | null = q.data ?? null;
  const showTshirt = eventHasTshirt(row?.event?.name);


  if (!row) {
    return (
      <div className="space-y-2">
        <EnterEventCta entryUrl={entryUrl} />
        <p className="px-1 text-[11px] text-ink-soft">
          Already entered? Your entry appears here once Entry Ninja syncs — contact the Red Cherry
          admins if it stays missing.
        </p>
      </div>
    );
  }

  const chips: { label: string; value: string; tone?: "cherry" | "dark" }[] = [];
  if (row.category) chips.push({ label: "Category", value: row.category });
  if (row.batch) chips.push({ label: "Batch", value: row.batch });
  if (row.bib_number) chips.push({ label: "Bib", value: `#${row.bib_number}`, tone: "dark" });

  return (
    <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft">
            Your entry
          </p>
          <p className="mt-0.5 font-display text-base font-bold text-ink">
            Everything Red Cherry has on file for you
          </p>
        </div>
        <Link
          to="/my-events/$eventId/report"
          params={{ eventId }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-bold text-white"
        >
          <Printer className="h-3.5 w-3.5" /> Report
        </Link>
      </div>

      {chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
          {chips.map((c) => (
            <span
              key={c.label}
              className={
                c.tone === "dark"
                  ? "rounded bg-ink px-2 py-0.5 text-white"
                  : "rounded bg-accent px-2 py-0.5 text-cherry-deep"
              }
            >
              {c.label}: {c.value}
            </span>
          ))}
        </div>
      ) : null}

      <PaymentStatusCard info={row} entryUrl={entryUrl} />

      {(row.jacket_size || (showTshirt && row.tshirt_size)) ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {row.jacket_size ? (
            <div className="rounded-xl bg-secondary p-2.5">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                <Shirt className="h-3 w-3" /> Jacket
              </p>
              <p className="mt-0.5 font-display text-sm font-bold text-ink">{row.jacket_size}</p>
            </div>
          ) : null}
          {showTshirt && row.tshirt_size ? (
            <div className="rounded-xl bg-secondary p-2.5">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                <Shirt className="h-3 w-3" /> T-Shirt
              </p>
              <p className="mt-0.5 font-display text-sm font-bold text-ink">{row.tshirt_size}</p>
            </div>
          ) : null}
        </div>
      ) : null}


      {rooming ? (
        <div className="mt-3 rounded-xl bg-secondary p-2.5">
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-ink-soft">
            <BedDouble className="h-3 w-3" /> Accommodation
          </p>
          <p className="mt-0.5 font-display text-sm font-bold text-ink">
            {rooming.tent_number ? `Tent / room ${rooming.tent_number}` : "Allocated"}
            {rooming.room_type ? <span className="font-semibold text-ink-soft"> · {rooming.room_type}</span> : null}
          </p>
          {rooming.venue?.name ? (
            <p className="text-[11px] text-ink-soft">{rooming.venue.name}</p>
          ) : null}
          {rooming.location_hint ? (
            <p className="text-[11px] text-ink-soft">{rooming.location_hint}</p>
          ) : null}
          {rooming.notes ? <p className="mt-1 text-[11px] text-ink-soft">{rooming.notes}</p> : null}
          {rooming.village_tent_id || rooming.village_zone_id || rooming.village_spot_id || rooming.venue?.village_spot_id ? (
            <button
              type="button"
              onClick={() =>
                focusVillage({
                  zoneId: rooming.village_zone_id,
                  spotId: rooming.village_spot_id ?? rooming.venue?.village_spot_id ?? null,
                  tentId: rooming.village_tent_id,
                })
              }
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-cherry px-2.5 py-1.5 text-[11px] font-bold text-white"
            >
              <MapPin className="h-3.5 w-3.5" /> Show me on the village map
            </button>
          ) : null}
        </div>
      ) : null}

      {row.extras.length > 0 ? (
        <div className="mt-3 space-y-3">
          {groupExtras(row.extras).map((g) => (
            <div key={g.key}>
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                <Package className="h-3 w-3" /> {g.label}
              </p>
              <ul className="mt-1.5 divide-y divide-border rounded-xl bg-secondary/60">
                {g.items.map((x, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
                    <span className="min-w-0 text-ink">
                      {x.name}
                      {x.option ? <span className="text-ink-soft"> · {x.option}</span> : null}
                    </span>
                    {x.qty > 1 ? (
                      <span className="shrink-0 font-semibold text-ink-soft">×{x.qty}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {/* Always offer the Entry Ninja hand-off: direct registration link when we
          have the ref, otherwise the event's own Entry Ninja page. */}
      <a
        href={
          entryNinjaRegistrationUrl(row.registration_ref) ??
          entryUrl ??
          "https://entries.redcherryevents.co.za/"
        }
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-cherry px-3 py-2.5 text-xs font-bold text-white"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Add or edit my entry on Entry Ninja
      </a>
      <p className="mt-1.5 text-[11px] text-ink-soft">
        Sizes, merchandise and rider details are managed on Entry Ninja — changes sync back here.
      </p>

      {row.notes ? (
        <p className="mt-3 rounded-lg bg-secondary/60 p-2 text-xs text-ink-soft">
          <span className="font-bold text-ink">Notes: </span>{row.notes}
        </p>
      ) : null}

      {chips.length === 0 && !row.jacket_size && !(showTshirt && row.tshirt_size) && row.extras.length === 0 ? (
        <p className="mt-3 text-xs text-ink-soft">
          Your entry is confirmed. Extras and sizes will appear here once they sync from Entry Ninja.
        </p>
      ) : null}

    </section>
  );
}
