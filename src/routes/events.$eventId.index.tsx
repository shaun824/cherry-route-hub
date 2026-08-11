import { createFileRoute, redirect } from "@tanstack/react-router";

// The old event overview page is retired — the full event info page is the
// single public destination for every event.
export const Route = createFileRoute("/events/$eventId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/my-events/$eventId",
      params: { eventId: params.eventId },
      replace: true,
    });
  },
});
