import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, MapPin, Package, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsCrew } from "@/lib/auth";
import { writeCrewEventId } from "@/lib/crew-event";

export const Route = createFileRoute("/crew/rentals")({
  head: () => ({
    meta: [
      { title: "Rental jobs · Crew · Red Cherry Events" },
      { name: "description", content: "Upcoming infrastructure rental jobs: build map, run sheet and load-out." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CrewRentals,
});

function CrewRentals() {
  const { isCrew, loading } = useIsCrew();
  const q = useQuery({
    queryKey: ["crew-rentals"],
    enabled: isCrew,
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const { data } = await (supabase as any)
        .from("events")
        .select("id, name, client_name, location, event_date, build_date, breakdown_date")
        .eq("event_type", "rental")
        .gte("event_date", since)
        .order("event_date", { ascending: true });
      return (data ?? []) as { id: string; name: string; client_name: string | null; location: string; event_date: string; build_date: string | null; breakdown_date: string | null }[];
    },
  });

  if (loading) return <div className="p-4"><div className="h-40 animate-pulse rounded-2xl bg-muted" /></div>;
  if (!isCrew) return <Navigate to="/crew/login" />;

  const pill = "flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold";
  return (
    <div className="space-y-4 p-4">
      <h1 className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Truck className="h-5 w-5 text-cherry" /> Rental jobs</h1>
      <p className="text-sm text-ink-soft">Infrastructure hire for client events — separate from race events.</p>
      {q.data?.length === 0 ? <p className="text-sm text-ink-soft">No upcoming rental jobs.</p> : null}
      <ul className="space-y-3">
        {q.data?.map((r) => (
          <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
            <p className="font-semibold text-ink">{r.name}</p>
            <p className="text-xs text-ink-soft">{[r.client_name, r.location].filter(Boolean).join(" · ")}</p>
            <p className="mt-1 text-xs text-ink">
              {r.build_date ? `Build ${r.build_date} · ` : ""}Event {new Date(r.event_date).toLocaleDateString("en-ZA")}
              {r.breakdown_date ? ` · Breakdown ${r.breakdown_date}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/crew/build" search={{ event: r.id }} className={pill}><MapPin className="h-3.5 w-3.5" /> Build map</Link>
              <Link to="/crew/run-sheet" onClick={() => writeCrewEventId(r.id)} className={pill}><ClipboardList className="h-3.5 w-3.5" /> Run sheet</Link>
              <Link to="/crew/inventory" onClick={() => writeCrewEventId(r.id)} className={pill}><Package className="h-3.5 w-3.5" /> Load-out</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
