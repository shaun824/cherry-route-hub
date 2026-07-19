import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, TypeBadge } from "@/components/ui-bits";
import { formatDate, formatTime } from "@/lib/mock-data";
import { useAdminStore } from "@/lib/store";
import { useHydratedStore } from "@/lib/use-hydrated-store";
import { MapPin, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/events/")({
  head: () => ({
    meta: [
      { title: "Events — Red Cherry Events" },
      { name: "description", content: "Browse upcoming Red Cherry events, view details and enter." },
    ],
  }),
  component: Events,
});

function Events() {
  useHydratedStore();
  const events = useAdminStore((s) => s.events).filter(
    (e) => (e.lifecycle ?? "published") === "published",
  );

  return (
    <div>
      <PageHeader title="Events" subtitle="Upcoming races & rides" />
      <ul className="space-y-3 px-5 py-5">
        {events.map((e) => (
          <li key={e.id}>
            <Link
              to="/events/$eventId"
              params={{ eventId: e.id }}
              className="block overflow-hidden rounded-2xl bg-card ring-1 ring-border active:scale-[0.99] transition-transform"
            >
              <div className={`relative overflow-hidden bg-gradient-to-br ${e.heroColor} px-4 py-4 text-white`}>
                {e.coverUrl ? (
                  <>
                    <img src={e.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </>
                ) : null}
                <div className="relative flex items-center justify-between">
                  <TypeBadge type={e.status} />
                  <span className="text-[11px] font-semibold uppercase tracking-widest opacity-85">
                    {e.discipline}
                  </span>
                </div>
                <div className="relative mt-3 flex items-center gap-3">
                  {e.logoUrl ? (
                    <img
                      src={e.logoUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg bg-white/10 object-contain p-1 ring-1 ring-white/25"
                    />
                  ) : null}
                  <p className="font-display text-lg font-bold leading-tight">{e.name}</p>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {formatDate(e.date)} · {formatTime(e.date)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {e.location} · {e.distanceKm}km
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {e.entered ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                      Entered
                    </span>
                  ) : null}
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
