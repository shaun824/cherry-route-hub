import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/spectate")({
  head: () => ({
    meta: [
      { title: "Track riders — Red Cherry Events" },
      { name: "description", content: "Follow Red Cherry rides: rider lists, bib numbers and results." },
      { property: "og:title", content: "Track riders — Red Cherry Events" },
      { property: "og:description", content: "Follow Red Cherry rides: rider lists, bib numbers and results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Outlet />,
});
