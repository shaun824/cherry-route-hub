import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VillageMapView } from "@/components/village-map-view";

type EmbedSearch = { venue?: string; view?: "crew" };

export const Route = createFileRoute("/embed/village/$eventId")({
  validateSearch: (search: Record<string, unknown>): EmbedSearch => ({
    venue: typeof search.venue === "string" && search.venue ? search.venue : undefined,
    // ?view=crew opens the build layout for people without a login (suppliers,
    // contractors) — village map data is already public, this only unlocks the
    // crew layers and build detail in the UI.
    view: search.view === "crew" ? "crew" : undefined,
  }),
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("events")
      .select("id, name")
      .eq("id", params.eventId)
      .maybeSingle();
    if (error || !data) throw notFound();
    return { event: data };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.event?.name ?? "Race village";
    const title = `${name} — Race village map`;
    const description = `Interactive race village map for ${name}: pins, zones and facilities.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: VillageEmbed,
  notFoundComponent: () => (
    <div className="grid h-[100dvh] place-items-center bg-background px-6 text-center text-sm text-ink-soft">
      This race village map isn't available.
    </div>
  ),
});

function VillageEmbed() {
  const { eventId } = Route.useParams();
  const { venue, view } = Route.useSearch();
  const crew = view === "crew";
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <VillageMapView
        eventId={eventId}
        venueId={venue ?? null}
        riderOnly={!crew}
        crewView={crew}
        startFullscreen
      />
      {/* Way into the full app — the embedded view has no navigation of its own. */}
      <Link
        to="/my-events/$eventId"
        params={{ eventId }}
        search={{ tab: "village" }}
        className="absolute right-3 z-[1200] flex items-center gap-1.5 rounded-full bg-cherry px-3.5 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-cherry/90"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        Open in the app
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
