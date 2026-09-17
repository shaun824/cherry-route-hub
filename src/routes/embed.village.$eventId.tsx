import { createFileRoute, notFound } from "@tanstack/react-router";
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
  const { venue } = Route.useSearch();
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-background">
      <VillageMapView eventId={eventId} venueId={venue ?? null} riderOnly />
    </div>
  );
}
