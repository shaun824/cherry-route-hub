// Crew race control: live rider map + SOS alerts. Crew and admin only.
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { RaceControlPanel } from "@/components/race-control";
import { useIsCrew } from "@/lib/auth";

export const Route = createFileRoute("/crew/tracking")({
  head: () => ({
    meta: [
      { title: "Race control · Crew · Red Cherry Events" },
      {
        name: "description",
        content: "Live rider positions and SOS alerts for crew on site.",
      },
      { property: "og:title", content: "Race control · Crew · Red Cherry Events" },
      {
        property: "og:description",
        content: "Live rider positions and SOS alerts for crew on site.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CrewTrackingPage,
});

function CrewTrackingPage() {
  const { isCrew, loading, user } = useIsCrew();

  if (loading) return <p className="p-4 text-sm text-ink-soft">Loading…</p>;
  if (!user) return <Navigate to="/crew/login" />;
  if (!isCrew)
    return (
      <p className="p-4 text-sm text-ink-soft">
        This area is for Red Cherry crew. Ask an admin to add you to the crew team.
      </p>
    );

  return (
    <div className="p-4">
      <RaceControlPanel title="Race control" />
    </div>
  );
}
