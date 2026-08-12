import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getEventPhotos, type EventPhoto } from "@/lib/event-photos.functions";
import { ExternalLink, ImageIcon, X, ChevronLeft, ChevronRight } from "lucide-react";

function sized(baseUrl: string, spec: string) {
  return `${baseUrl}=${spec}`;
}

export function EventPhotosPanel({ eventId }: { eventId: string }) {
  const load = useServerFn(getEventPhotos);
  const [open, setOpen] = useState<number | null>(null);

  const q = useQuery({
    queryKey: ["event-photos", eventId],
    queryFn: () => load({ data: { eventId } }),
    staleTime: 30 * 60 * 1000,
  });

  if (q.isLoading) {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  const albumUrl = q.data?.albumUrl ?? null;
  const photos: EventPhoto[] = q.data?.photos ?? [];

  if (!albumUrl) {
    return (
      <div className="rounded-2xl bg-card p-6 text-center ring-1 ring-border">
        <ImageIcon className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm text-ink-soft">Photos from this event will appear here soon.</p>
      </div>
    );
  }

  const current = open != null ? photos[open] : undefined;

  return (
    <div className="space-y-4">
      {photos.length === 0 ? (
        <div className="rounded-2xl bg-card p-6 text-center ring-1 ring-border">
          <ImageIcon className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm text-ink-soft">
            {q.data?.error ?? "The album is still being processed."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
          {photos.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpen(i)}
                className="block w-full overflow-hidden rounded-lg ring-1 ring-border"
              >
                <img
                  src={sized(p.baseUrl, "w400-h400-c")}
                  alt="Event photo"
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <a
        href={albumUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl bg-card px-4 py-3 text-sm font-semibold text-ink ring-1 ring-border"
      >
        Open full album in Google Photos <ExternalLink className="h-4 w-4" />
      </a>

      {current ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(null)}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white"
            onClick={() => setOpen(null)}
          >
            <X className="h-5 w-5" />
          </button>
          {open! > 0 ? (
            <button
              type="button"
              aria-label="Previous"
              className="absolute left-3 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => (v == null ? v : Math.max(0, v - 1)));
              }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}
          {open! < photos.length - 1 ? (
            <button
              type="button"
              aria-label="Next"
              className="absolute right-3 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => (v == null ? v : Math.min(photos.length - 1, v + 1)));
              }}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : null}
          <img
            src={sized(current.baseUrl, "w1600")}
            alt="Event photo"
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
