import { createFileRoute } from "@tanstack/react-router";

// Tour de Addo website contact form. Called from the browser on the allow-listed sites only.
export const Route = createFileRoute("/api/public/tda-enquiry")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { tdaCorsHeaders } = await import("@/lib/tda-enquiry");
        return new Response(null, { status: 204, headers: tdaCorsHeaders(request.headers.get("origin")) });
      },
      POST: async ({ request }) => {
        const { handleTdaEnquiry } = await import("@/lib/tda-enquiry.server");
        return handleTdaEnquiry(request);
      },
    },
  },
});
