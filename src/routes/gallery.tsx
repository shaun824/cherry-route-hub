import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui-bits";
import { media, events, relativeTime } from "@/lib/mock-data";
import { Heart, MessageCircle, Share2 } from "lucide-react";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — Red Cherry Events" },
      { name: "description", content: "Photos and videos from Red Cherry event days." },
    ],
  }),
  component: Gallery,
});

const gradients = [
  "linear-gradient(135deg, oklch(0.45 0.2 20), oklch(0.25 0.12 20))",
  "linear-gradient(135deg, oklch(0.55 0.15 30), oklch(0.35 0.1 15))",
  "linear-gradient(135deg, oklch(0.5 0.1 60), oklch(0.3 0.08 40))",
];

function Gallery() {
  return (
    <div>
      <PageHeader title="Highlights" subtitle="From the day" />
      <ul className="space-y-4 px-5 py-5">
        {media.map((m, i) => {
          const event = events.find((e) => e.id === m.eventId);
          return (
            <li key={m.id} className="overflow-hidden rounded-2xl bg-card ring-1 ring-border">
              <div
                className="aspect-[4/5] w-full"
                style={{ backgroundImage: gradients[i % gradients.length] }}
                role="img"
                aria-label={m.imagePrompt}
              />
              <div className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full cherry-gradient font-display text-xs font-bold text-white">
                    RC
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">Red Cherry Events</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {event?.name} · {relativeTime(m.postedAt)}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-ink">{m.caption}</p>
                <div className="mt-3 flex items-center gap-4 text-muted-foreground">
                  <button className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft">
                    <Heart className="h-4 w-4" /> {m.likes}
                  </button>
                  <button className="inline-flex items-center gap-1 text-xs font-semibold text-ink-soft">
                    <MessageCircle className="h-4 w-4" /> 12
                  </button>
                  <button className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-ink-soft">
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
