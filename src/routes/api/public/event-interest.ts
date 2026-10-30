import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/event-interest")({
  server: { handlers: { POST: async ({ request }) => {
    const { handleEventInterest } = await import("@/lib/event-interest-handler.server");
    return handleEventInterest(request);
  } } },
});
