import { createFileRoute } from "@tanstack/react-router";

// Auto-generated 1200x630 link-preview thumbnails. Public on purpose: crawlers
// fetch it without a session. It only reads public event name/cover/logo and
// never returns private data.
export const Route = createFileRoute("/api/public/og")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { renderOgImage } = await import("@/lib/og-render.server");
        return renderOgImage(request);
      },
    },
  },
});
