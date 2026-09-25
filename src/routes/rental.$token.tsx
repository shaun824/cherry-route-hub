import { createFileRoute, notFound } from "@tanstack/react-router";
import { CalendarDays, ClipboardList, MapPin, Package, Phone } from "lucide-react";
import { getRentalByToken } from "@/lib/rentals.functions";
import { VillageMapView } from "@/components/village-map-view";

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
      <header className="relative overflow-hidden cherry-gradient px-5 pb-6 pt-10 text-white">
        {event.cover_url ? (
          <>
            <img src={event.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          </>
        ) : null}
        <div className="relative mx-auto max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-widest opacity-85">Red Cherry Events · Infrastructure</p>
          <h1 className="mt-1 font-display text-2xl font-bold leading-tight">{event.name}</h1>
          {event.client_name ? <p className="mt-1 text-sm opacity-90">For {event.client_name}</p> : null}
          {event.location ? (
            <p className="mt-3 flex items-center gap-2 text-sm"><MapPin className="h-4 w-4" /> {event.location}</p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 p-4 pb-12">
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
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-ink">{icon} {title}</h2>
      {children}
    </section>
  );
}
