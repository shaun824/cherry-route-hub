import { createFileRoute } from "@tanstack/react-router";
import { EmbeddedAssistant } from "@/components/embedded-assistant";

export const Route = createFileRoute("/embed/chat")({
  head: () => ({
    meta: [
      { title: "Red Cherry Assistant" },
      {
        name: "description",
        content: "Ask the Red Cherry assistant about events, entries and the Rider Hub.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Red Cherry Assistant" },
      {
        property: "og:description",
        content: "Ask the Red Cherry assistant about events, entries and the Rider Hub.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatEmbed,
});

function ChatEmbed() {
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-background">
      <EmbeddedAssistant />
    </div>
  );
}
