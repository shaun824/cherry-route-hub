import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, TypeBadge } from "@/components/ui-bits";
import { feed, relativeTime } from "@/lib/mock-data";
import { Pin } from "lucide-react";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "News Feed — Red Cherry Events" },
      { name: "description", content: "Race notices, weather warnings and event news from Red Cherry Events." },
    ],
  }),
  component: Feed,
});

function Feed() {
  const sorted = [...feed].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (b.pinned && !a.pinned) return 1;
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
  });

  return (
    <div>
      <PageHeader title="News Feed" subtitle="Race notices, updates & alerts" />
      <ul className="space-y-3 px-5 py-5">
        {sorted.map((p) => (
          <li
            key={p.id}
            className={`relative rounded-2xl p-4 ring-1 ${
              p.pinned
                ? "bg-amber-50 ring-amber-300/60"
                : "bg-card ring-border"
            }`}
          >
            <div className="flex items-center gap-2">
              <TypeBadge type={p.type} />
              {p.pinned ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-900">
                  <Pin className="h-3 w-3" /> Pinned
                </span>
              ) : null}
              <span className="ml-auto text-[11px] text-muted-foreground">
                {relativeTime(p.postedAt)}
              </span>
            </div>
            <h3 className="mt-2 font-display text-base font-bold leading-snug text-ink">
              {p.title}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{p.body}</p>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {p.author}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
