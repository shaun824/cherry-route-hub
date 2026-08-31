import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HardHat } from "lucide-react";
import { useIsCrew } from "@/lib/auth";
import { fetchAllCrewEvents, fetchCrewEvents } from "@/lib/crew";
import { useCrewEvent, useCrewShowPast } from "@/lib/crew-event";
import { VillageMapView } from "@/components/village-map-view";
import { OfflinePackCard } from "@/components/offline-pack-card";

export const Route = createFileRoute("/crew/build")({
  head: () => ({
    meta: [
      { title: "Field build map · Red Cherry Events" },
      {
        name: "description",
        content:
          "Crew build tool: generators, water, fencing, structures, flags and signage placed on the village map with quantities and sizes.",
      },
      { property: "og:title", content: "Field build map · Red Cherry Events" },
      {
        property: "og:description",
        content: "Every infrastructure and branding placement for the race village, with quantities and sizes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CrewBuildPage,
});

function CrewBuildPage() {
  const { isCrew, loading } = useIsCrew();
  const [showPast] = useCrewShowPast();
  const eventsQ = useQuery({
    queryKey: ["crew-events", showPast ? "all" : "visible"],
    queryFn: showPast ? fetchAllCrewEvents : fetchCrewEvents,
    enabled: isCrew,
  });
  const events = eventsQ.data ?? [];
  const [eventId, setEventId] = useCrewEvent(events);

  if (loading) return <div className="p-4"><div className="h-40 animate-pulse rounded-2xl bg-muted" /></div>;
  if (!isCrew) return <Navigate to="/crew/login" />;

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="flex items-center gap-2 font-display text-xl font-bold text-ink">
          <HardHat className="h-5 w-5 text-cherry" /> Field build map
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Infrastructure and branding placements for the race village — quantities, sizes and exactly
          where each item goes. Riders never see these layers.
        </p>
      </header>

      {events.length > 1 ? (
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      ) : null}

      {eventId ? (
        <>
          <VillageMapView eventId={eventId} defaultLayers={["rider", "infra", "branding"]} />
          <OfflinePackCard event={{ id: eventId }} />
        </>
      ) : null}
    </div>
  );
}
