// Shareable full-screen event assistant, linked from rider emails.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { EmbeddedAssistant, eventWaLink } from "@/components/embedded-assistant";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/ask/$eventId")({
  head: () => ({
    meta: [
      { title: "Ask the event assistant · Red Cherry Events" },
      { name: "description", content: "Ask questions about your Red Cherry event — start times, parking, routes, packing and your entry." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Ask the event assistant · Red Cherry Events" },
      { property: "og:description", content: "Ask questions about your Red Cherry event — start times, parking, routes, packing and your entry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AskEventPage,
});

function AskEventPage() {
  const { eventId } = Route.useParams();
  const valid = /^[0-9a-f-]{36}$/i.test(eventId);
  const q = useQuery({
    queryKey: ["ask-event", eventId],
    enabled: valid,
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, name").eq("id", eventId).maybeSingle();
      return data ?? null;
    },
  });

  if (valid && q.isLoading) {
    return <div className="grid h-[100dvh] place-items-center bg-background text-sm text-ink-soft">Loading assistant…</div>;
  }
  if (!valid || !q.data) {
    return (
      <div className="grid h-[100dvh] place-items-center bg-background p-6 text-center">
        <div className="max-w-sm">
          <p className="font-display text-lg font-bold text-ink">We couldn't find that event</p>
          <p className="mt-2 text-sm text-ink-soft">The link may be old or mistyped. Message us and we'll help straight away.</p>
          <a href={eventWaLink()} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
            Chat to us on WhatsApp
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-background">
      <div className="mx-auto h-full max-w-3xl">
        <EmbeddedAssistant event={{ id: q.data.id, name: q.data.name }} />
      </div>
    </div>
  );
}
