import { visibleInBackend } from "@/lib/event-window";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/event-info/")({
  component: EventInfoIndex,
});

function EventInfoIndex() {
  const q = useQuery({
    queryKey: ["admin-events-info-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, event_date, days, event_info_blocks:event_info_blocks(event_id)")
        .order("event_date", { ascending: true });
      return visibleInBackend((data ?? []) as { id: string; name: string; event_date: string; days?: unknown[] }[]);
    },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">Rider info</h1>
        <p className="text-sm text-ink-soft">
          Pick an event to edit the venue, packing list, route, rules, FAQs, and emergency
          contacts riders see in Events Hub.
        </p>
      </header>

      <ul className="space-y-2">
        {(q.data ?? []).map((e: any) => {
          const hasInfo = (e.event_info_blocks?.length ?? 0) > 0;
          return (
            <li key={e.id}>
              <Link
                to="/admin/event-info/$eventId"
                params={{ eventId: e.id }}
                className="flex items-center justify-between rounded-2xl bg-card p-4 ring-1 ring-border hover:bg-secondary"
              >
                <div>
                  <p className="font-semibold text-ink">{e.name}</p>
                  <p className="text-xs text-ink-soft">
                    {new Date(e.event_date).toLocaleDateString("en-ZA", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      hasInfo ? "bg-emerald-100 text-emerald-900" : "bg-secondary text-ink-soft"
                    }`}
                  >
                    <ScrollText className="mr-1 inline h-3 w-3" />
                    {hasInfo ? "Published" : "Not set up"}
                  </span>
                  <ChevronRight className="h-4 w-4 text-ink-soft" />
                </div>
              </Link>
            </li>
          );
        })}
        {q.isLoading ? (
          <li className="text-sm text-ink-soft">Loading…</li>
        ) : (q.data ?? []).length === 0 ? (
          <li className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-ink-soft">
            No events in the database yet.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
