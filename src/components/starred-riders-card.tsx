// Profile card: every rider you've starred, grouped by event, one tap to their rider page.
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { useAdminStore } from "@/lib/store";

export function StarredRidersCard() {
  const { user } = useSession();
  const events = useAdminStore((s) => s.events);
  const { data } = useQuery({
    queryKey: ["starred-riders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("rider_favourites")
        .select("event_id, event_entrant_id, full_name, bib_number, category")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  if (!data?.length) return null;
  const byEvent = new Map<string, typeof data>();
  for (const f of data) byEvent.set(f.event_id, [...(byEvent.get(f.event_id) ?? []), f]);

  return (
    <section className="mx-5 mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
      <h2 className="flex items-center gap-2 font-display text-sm font-bold">
        <Star className="h-4 w-4 fill-cherry text-cherry" /> Riders you follow
      </h2>
      <div className="mt-2 space-y-3">
        {[...byEvent.entries()].map(([eventId, list]) => (
          <div key={eventId}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-cherry">
              {events.find((e) => e.id === eventId)?.name ?? "Event"}
            </p>
            <ul className="mt-1 divide-y divide-border">
              {list.map((f) => (
                <li key={f.event_entrant_id}>
                  <Link
                    to="/spectate/$eventId/rider/$entrantId"
                    params={{ eventId, entrantId: f.event_entrant_id }}
                    className="flex items-center gap-2 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">{f.full_name}</span>
                    <span className="text-xs text-ink-soft">{f.bib_number ? `#${f.bib_number}` : f.category}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
