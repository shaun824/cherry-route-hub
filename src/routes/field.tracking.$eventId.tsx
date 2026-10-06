// No-sign-in race-control view for medics/marshals, opened from a crew share link.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Navigation, Radar, Siren } from "lucide-react";
import { z } from "zod";
import { LiveTrackingMap } from "@/components/live-tracking-map";
import { fetchFieldLinkSos } from "@/lib/crew-field-link.functions";
import { RaceStatusPanel } from "@/components/race-status-panel";
import { useHydratedStore } from "@/lib/use-hydrated-store";

export const Route = createFileRoute("/field/tracking/$eventId")({
  validateSearch: z.object({ k: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Field race control · Red Cherry Events" },
      { name: "description", content: "Live rider map, SOS alerts and waterpoints for event medics and marshals." },
      { property: "og:title", content: "Field race control · Red Cherry Events" },
      { property: "og:description", content: "Live rider map, SOS alerts and waterpoints for event medics and marshals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: FieldTrackingPage,
});

function FieldTrackingPage() {
  // Load event data (routes, waterpoints) — this page skips the normal app shell.
  useHydratedStore();
  const { eventId } = Route.useParams();
  const { k } = Route.useSearch();
  const q = useQuery({
    queryKey: ["field-link-sos", eventId, k],
    queryFn: () => fetchFieldLinkSos({ data: { eventId, token: k ?? "" } }),
    enabled: Boolean(k),
    refetchInterval: 5_000,
  });

  if (!k || (q.data && !q.data.ok)) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="font-display text-lg font-bold text-ink">This link has expired or isn't valid</p>
        <p className="mt-2 text-sm text-ink-soft">Ask race control to share a fresh link.</p>
        <Link to="/crew/login" className="mt-4 inline-block text-sm font-semibold text-cherry">
          Crew sign in
        </Link>
      </div>
    );
  }
  if (!q.data) return <p className="p-4 text-sm text-ink-soft">Loading race control…</p>;

  const alerts = q.data.alerts;
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Radar className="h-5 w-5 text-cherry" />
        <h1 className="font-display text-lg font-bold text-ink">{q.data.eventName} · Race control</h1>
      </div>
      {alerts.length > 0 ? (
        <div className="space-y-2 rounded-2xl border-2 border-cherry bg-cherry/10 p-3">
          <p className="flex items-center gap-2 font-display font-black text-ink">
            <Siren className="h-5 w-5 text-cherry" /> {alerts.length} open SOS
          </p>
          {alerts.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-xl bg-card p-2 ring-1 ring-border">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-bold text-ink">{a.riderName ?? "Unknown rider"}</p>
                <p className="text-xs text-ink-soft">
                  {[a.reason, a.note, a.status === "acknowledged" ? "seen by race control" : "not yet acknowledged"]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {a.lat != null && a.lng != null ? (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}&travelmode=driving`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-cherry px-3 py-2 text-xs font-bold text-white"
                >
                  <Navigation className="h-3.5 w-3.5" /> Go
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <LiveTrackingMap eventId={eventId} isCrew fieldToken={k} />
      <RaceStatusPanel eventId={eventId} fieldToken={k} />
      <p className="text-xs text-ink-soft">
        Tap Full screen to search riders, see waterpoints and navigate. To acknowledge an SOS, crew must sign in.
      </p>
    </div>
  );
}
