// Admin race control: live rider map + SOS alert list for a chosen event.
import { createFileRoute } from "@tanstack/react-router";
import { RaceControlPanel } from "@/components/race-control";

export const Route = createFileRoute("/admin/tracking")({
  head: () => ({
    meta: [
      { title: "Live tracking · Admin · Red Cherry Rider Hub" },
      { name: "description", content: "Red Cherry race control: live rider positions, route navigation and SOS management." },
      { property: "og:title", content: "Live tracking · Admin · Red Cherry Rider Hub" },
      { property: "og:description", content: "Live rider positions, route navigation and SOS management for Red Cherry race control." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTrackingPage,
});

function AdminTrackingPage() {
  return <RaceControlPanel />;
}
