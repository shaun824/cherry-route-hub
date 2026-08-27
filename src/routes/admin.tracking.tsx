// Admin race control: live rider map + SOS alert list for a chosen event.
import { createFileRoute } from "@tanstack/react-router";
import { RaceControlPanel } from "@/components/race-control";

export const Route = createFileRoute("/admin/tracking")({
  head: () => ({
    meta: [
      { title: "Live tracking · Admin · Red Cherry Rider Hub" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTrackingPage,
});

function AdminTrackingPage() {
  return <RaceControlPanel />;
}
