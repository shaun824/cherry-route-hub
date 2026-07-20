import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RouteMap } from "@/components/route-map";

export const Route = createFileRoute("/events/$eventId/map")({
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("events")
      .select("id, name, days")
      .eq("id", params.eventId)
      .maybeSingle();
    if (error || !data) throw notFound();
    return { event: data };
  },
  component: FullscreenMap,
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-ink-soft">
      Event not found.{" "}
      <Link to="/events" className="font-semibold text-cherry">
        Back
      </Link>
    </div>
  ),
});

function FullscreenMap() {
  const { event } = Route.useLoaderData();
  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Link
          to="/events/$eventId"
          params={{ eventId: event.id }}
          className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-ink"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">Route map</p>
          <h1 className="truncate font-display text-base font-bold text-ink">{event.name}</h1>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <RouteMap event={event as never} height="100%" />
      </div>
    </div>
  );
}
