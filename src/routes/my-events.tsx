import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/my-events")({
  head: () => ({
    meta: [
      { title: "Events Hub — Red Cherry Events" },
      { name: "description", content: "Your entered events, key info, group chat and admin Q&A." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <Outlet />,
});
