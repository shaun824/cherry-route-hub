import { ogImageMeta, eventOgImageUrl, OG_SITE } from "@/lib/og";
import { BackLink } from "@/components/back-link";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RouteMap } from "@/components/route-map";

export const Route = createFileRoute("/events/$eventId/map")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("events")
      .select("id, name, days")
      .eq("id", params.eventId)
      .maybeSingle();
    if (error || !data) throw notFound();
    return { event: data };
  },
  head: ({ params }) => ({ meta: [
      ...ogImageMeta(eventOgImageUrl(params.eventId, "Route map"), "Event route map"),
    { title: 'Event route map · Red Cherry Rider Hub' },
    { name: 'description', content: 'Explore event routes, waterpoints and fullscreen GPS route navigation.' },
    { property: 'og:title', content: 'Event route map · Red Cherry Rider Hub' },
    { property: 'og:description', content: 'Explore event routes, waterpoints and fullscreen GPS route navigation.' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: `${OG_SITE}/events/${params.eventId}/map` },
  ],
  links: [{ rel: "canonical", href: `${OG_SITE}/events/${params.eventId}/map` }] }),
  component: FullscreenMap,
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-ink-soft">
      Event not found.{" "}
      <Link to="/events" className="font-semibold text-cherry">
        Back
      </Link>
    </div>
  ),
});

function FullscreenMap() {
  const { event } = Route.useLoaderData();
  return (
    <div className="flex h-[100dvh] flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <BackLink
          to="/events/$eventId"
          params={{ eventId: event.id }}
          className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-ink"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </BackLink>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">Route map</p>
          <h1 className="truncate font-display text-base font-bold text-ink">{event.name}</h1>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <RouteMap event={event as never} height="100%" />
      </div>
    </div>
  );
}
