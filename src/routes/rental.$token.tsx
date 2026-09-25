import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, MapPin, Package, Phone, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { getRentalByToken } from "@/lib/rentals.functions";
import { VillageMapView } from "@/components/village-map-view";
import bedouinImage from "@/assets/rentals/bed-one.jpg.asset.json";
import tentVillageImage from "@/assets/rentals/lux-single.jpg.asset.json";
import tentInteriorImage from "@/assets/rentals/lux-double.jpg.asset.json";
import chillZoneImage from "@/assets/rentals/odds.jpg.asset.json";
import showerImage from "@/assets/rentals/shower.jpg.asset.json";
import redCherryLogo from "@/assets/rentals/red-cherry-events-logo.png.asset.json";

export const Route = createFileRoute("/rental/$token")({
  loader: async ({ params }) => {
    const page = await getRentalByToken({ data: { token: params.token } }).catch(() => null);
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.event.name ?? "Event";
    const title = `${name} — Red Cherry Events infrastructure`;
    const description = `Dates, venue map, run sheet and equipment for ${name}, supplied by Red Cherry Events.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex,nofollow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: RentalPage,
  errorComponent: () => <Msg text="This page couldn't load. Please try again shortly." />,
  notFoundComponent: () => <Msg text="This link isn't valid any more. Ask Red Cherry Events for a new one." />,
});

function Msg({ text }: { text: string }) {
  return <div className="grid min-h-[100dvh] place-items-center bg-background px-6 text-center text-sm text-ink-soft">{text}</div>;
}

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : null;

const GALLERY = [
  { src: tentVillageImage.url, alt: "Red Cherry luxury tent village", label: "Luxury tent villages" },
  { src: bedouinImage.url, alt: "Red Cherry Bedouin stretch tent", label: "Shared spaces built to gather" },
  { src: tentInteriorImage.url, alt: "Made-up beds inside a luxury dome tent", label: "Comfort, ready on arrival" },
  { src: chillZoneImage.url, alt: "Relaxed event chill zone under canvas", label: "Details that make it memorable" },
  { src: showerImage.url, alt: "Red Cherry mobile shower units", label: "Complete site infrastructure" },
] as const;

type Countdown = { days: number; hours: number; minutes: number; seconds: number };

function getCountdown(target: string | null): Countdown | null {
  if (!target) return null;
  const remaining = new Date(target).getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  return {
    days: Math.floor(remaining / 86400000),
    hours: Math.floor((remaining % 86400000) / 3600000),
    minutes: Math.floor((remaining % 3600000) / 60000),
    seconds: Math.floor((remaining % 60000) / 1000),
  };
}

function EventCountdown({ date }: { date: string | null }) {
  const [countdown, setCountdown] = useState<Countdown | null>(null);
  useEffect(() => {
    const update = () => setCountdown(getCountdown(date));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [date]);
  if (!date || !countdown) return null;
  return (
    <section className="bg-foreground px-4 py-5 text-background" aria-label="Countdown to the event">
      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex items-center justify-center gap-2 text-center text-[11px] font-bold uppercase tracking-widest text-background/75">
          <Sparkles className="h-4 w-4 text-primary" /> Your event comes to life in
        </div>
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-2">
          {([
            ["Days", countdown.days],
            ["Hours", countdown.hours],
            ["Minutes", countdown.minutes],
            ["Seconds", countdown.seconds],
          ] as const).map(([label, value]) => (
            <div key={label} className="border-l border-background/20 text-center first:border-l-0">
              <p className="font-display text-2xl font-bold tabular-nums sm:text-3xl">{String(value).padStart(2, "0")}</p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-background/65">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RentalPage() {
  const { event, runSheet, equipment } = Route.useLoaderData();
  const days = new Map<string, typeof runSheet>();
  for (const t of runSheet) {
    const k = t.day_label || "Schedule";
    days.set(k, [...(days.get(k) ?? []), t]);
  }
  const dates = [
    ["Build", fmt(event.build_date)],
    ["Event", fmt(event.event_date)],
    ["Breakdown", fmt(event.breakdown_date)],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="relative flex min-h-[min(76vh,640px)] items-end overflow-hidden bg-foreground px-5 pb-9 pt-20 text-background">
        <img
          src={event.cover_url || tentVillageImage.url}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/65 to-foreground/15" />
        <div className="absolute left-0 top-0 h-1.5 w-full brand-gradient" />
        <div className="relative mx-auto w-full max-w-5xl">
          <div className="mb-8 inline-flex items-center gap-2 border border-background/25 bg-foreground/55 px-3 py-2 backdrop-blur-sm">
            <img src={redCherryLogo.url} alt="Red Cherry Events" className="h-7 w-auto brightness-0 invert" />
            <span className="border-l border-background/30 pl-2 text-[10px] font-bold uppercase tracking-widest text-background/80">Infrastructure</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Your event. Built by Red Cherry.</p>
          <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold leading-tight sm:text-5xl">{event.name}</h1>
          {event.client_name ? <p className="mt-2 text-base text-background/85">Prepared for {event.client_name}</p> : null}
          {event.location ? (
            <p className="mt-5 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" /> {event.location}</p>
          ) : null}
        </div>
      </header>

      <EventCountdown date={event.event_date} />

      <section className="border-b border-border bg-card px-4 py-5">
        <div className="mx-auto grid max-w-5xl grid-cols-3 divide-x divide-border text-center">
          <div className="px-2"><p className="font-display text-xl font-bold text-primary sm:text-2xl">Since 2001</p><p className="mt-1 text-[10px] font-semibold uppercase text-ink-soft">Building events</p></div>
          <div className="px-2"><p className="font-display text-xl font-bold text-primary sm:text-2xl">20+ years</p><p className="mt-1 text-[10px] font-semibold uppercase text-ink-soft">Years in business</p></div>
          <div className="px-2"><p className="font-display text-xl font-bold text-primary sm:text-2xl">Nationwide</p><p className="mt-1 text-[10px] font-semibold uppercase text-ink-soft">Delivery</p></div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl space-y-7 p-4 pb-12 sm:py-8">
        <Card icon={<CalendarDays className="h-4 w-4 text-cherry" />} title="Dates">
          <ul className="space-y-1 text-sm">
            {dates.map(([k, v]) => (
              <li key={k} className="flex justify-between gap-3"><span className="text-ink-soft">{k}</span><span className="font-semibold text-ink">{v}</span></li>
            ))}
          </ul>
          {event.client_contact ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-ink"><Phone className="h-4 w-4 text-cherry" /> {event.client_contact}</p>
          ) : null}
          {event.description ? <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{event.description}</p> : null}
        </Card>

        <section aria-labelledby="built-by-red-cherry">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">All under one roof</p>
              <h2 id="built-by-red-cherry" className="mt-1 font-display text-xl font-bold text-ink">A glimpse of what we're building</h2>
            </div>
            <p className="hidden max-w-xs text-right text-xs text-ink-soft sm:block">Transported, set up and supported by an experienced on-site team.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6 sm:grid-rows-2">
            {GALLERY.map((image, index) => (
              <figure
                key={image.src}
                className={`group relative min-h-36 overflow-hidden rounded-lg ${index === 0 ? "col-span-2 row-span-2 min-h-64 sm:col-span-4 sm:min-h-80" : "sm:col-span-2"}`}
              >
                <img src={image.src} alt={image.alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-transparent to-transparent" />
                <figcaption className="absolute inset-x-0 bottom-0 p-3 text-xs font-bold text-background sm:text-sm">{image.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <Card icon={<MapPin className="h-4 w-4 text-cherry" />} title="Venue map">
          <div className="h-[60vh] overflow-hidden rounded-xl">
            <VillageMapView eventId={event.id} riderOnly />
          </div>
        </Card>

        <Card icon={<ClipboardList className="h-4 w-4 text-cherry" />} title="Run sheet">
          {runSheet.length === 0 ? (
            <p className="text-sm text-ink-soft">The run sheet will appear here once it's ready.</p>
          ) : (
            [...days].map(([day, rows]) => (
              <div key={day} className="mb-4 last:mb-0">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-cherry">{day}</h3>
                <ul className="divide-y divide-border">
                  {rows.map((t) => (
                    <li key={t.id} className="flex gap-3 py-2 text-sm">
                      <span className="w-24 shrink-0 font-semibold text-ink">{[t.start_time, t.end_time].filter(Boolean).join("–")}</span>
                      <span className="min-w-0">
                        <span className="text-ink">{t.task}</span>
                        {t.location ? <span className="block text-xs text-ink-soft">{t.location}</span> : null}
                        {t.detail ? <span className="block text-xs text-ink-soft">{t.detail}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </Card>

        <Card icon={<Package className="h-4 w-4 text-cherry" />} title="Equipment">
          {equipment.length === 0 ? (
            <p className="text-sm text-ink-soft">The equipment list will appear here once it's confirmed.</p>
          ) : (
            <ul className="divide-y divide-border">
              {equipment.map((g) => (
                <li key={g.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="text-ink">{g.name}{g.size_spec ? <span className="text-ink-soft"> · {g.size_spec}</span> : null}</span>
                  <span className="shrink-0 font-semibold text-ink">{g.qty_label || (g.qty != null ? `× ${g.qty}` : "")}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>

      <section className="bg-foreground px-5 py-12 text-center text-background">
        <div className="mx-auto max-w-3xl">
          <div className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-full border border-background/20 bg-background/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Your event is in experienced hands</p>
          <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Transport. Set up. Supervise.</h2>
          <div className="mx-auto mt-5 grid max-w-xl grid-cols-3 gap-2 text-xs font-semibold text-background/75">
            <span className="flex flex-col items-center gap-2"><Truck className="h-5 w-5 text-primary" /> Nationwide</span>
            <span className="flex flex-col items-center gap-2"><Package className="h-5 w-5 text-primary" /> One supplier</span>
            <span className="flex flex-col items-center gap-2"><Phone className="h-5 w-5 text-primary" /> On-site support</span>
          </div>
          <a href="https://redcherryevents.co.za/infrastructure-rental/" target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">Explore Red Cherry infrastructure</a>
          <div className="mt-10 border-t border-background/15 pt-8">
            <img src={redCherryLogo.url} alt="Red Cherry Events" className="mx-auto h-14 w-auto brightness-0 invert" />
            <p className="mt-3 text-xs text-background/60">Building extraordinary outdoor experiences since 2001.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="card-elevated rounded-lg p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-ink">{icon} {title}</h2>
      {children}
    </section>
  );
}
