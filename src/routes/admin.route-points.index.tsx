import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, MapPinned } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { visibleInBackend } from "@/lib/event-window";

export const Route = createFileRoute("/admin/route-points/")({
  head: () => ({ meta: [{ title: "Route points · Admin" }, { name: "robots", content: "noindex" }] }),
  component: RoutePointsIndex,
});

function RoutePointsIndex() {
  const q = useQuery({
    queryKey: ["admin-route-points-list"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, name, event_date, days").order("event_date", { ascending: true });
      return visibleInBackend((data ?? []) as { id: string; name: string; event_date: string; days?: any[] }[]);
    },
  });
  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">Route points</h1>
        <p className="text-sm text-ink-soft">Add marshal spots and points on the routes, and drag waterpoints to new places.</p>
      </header>
      <ul className="space-y-2">
        {(q.data ?? []).map((e) => {
          const routes = (e.days ?? []).reduce((n: number, d: any) => n + (d?.routes?.length ?? 0), 0);
          return (
            <li key={e.id}>
              <Link
                to="/admin/route-points/$eventId"
                params={{ eventId: e.id }}
                className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-border hover:ring-cherry"
              >
                <MapPinned className="h-5 w-5 text-cherry" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{e.name}</p>
                  <p className="text-xs text-ink-soft">{routes ? `${routes} route${routes === 1 ? "" : "s"}` : "No routes yet"}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-ink-soft" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
