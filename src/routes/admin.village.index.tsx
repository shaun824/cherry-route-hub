import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Tent } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/village/")({
  component: VillageIndex,
});

function VillageIndex() {
  const q = useQuery({
    queryKey: ["admin-village-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, name, event_date, event_village_maps:event_village_maps(event_id, image_url, hotspots, zones, geo)")
        .order("event_date", { ascending: true });
      return data ?? [];
    },

  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink">Village maps</h1>
        <p className="text-sm text-ink-soft">
          Upload a site plan per event and drop interactive points so riders can explore the
          village — registration, food, camping, bike wash and more.
        </p>
      </header>

      <ul className="space-y-2">
        {(q.data ?? []).map((e: any) => {
          const rows = e.event_village_maps ?? [];
          const points = rows.reduce(
            (n: number, r: any) => n + (Array.isArray(r?.hotspots) ? r.hotspots.length : 0),
            0,
          );
          const zones = rows.reduce(
            (n: number, r: any) => n + (Array.isArray(r?.zones) ? r.zones.length : 0),
            0,
          );
          const hasImage = rows.some((r: any) => !!r?.image_url);
          const hasGeo = rows.some((r: any) => Number.isFinite(Number(r?.geo?.lat)));
          const built = points > 0 || zones > 0 || hasImage || hasGeo;
          const parts = [
            points ? `${points} point${points === 1 ? "" : "s"}` : null,
            zones ? `${zones} area${zones === 1 ? "" : "s"}` : null,
            hasImage ? "plan image" : null,
          ].filter(Boolean);
          return (
            <li key={e.id}>
              <Link
                to="/admin/village/$eventId"
                params={{ eventId: e.id }}
                className="flex items-center justify-between rounded-2xl bg-card p-4 ring-1 ring-border hover:bg-secondary"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted">
                    <Tent className="h-4 w-4 text-ink-soft" />
                  </span>
                  <div>
                    <p className="font-semibold text-ink">{e.name}</p>
                    <p className="text-xs text-ink-soft">
                      {built ? (parts.length ? parts.join(" · ") : "Map placed") : "No map yet"}
                    </p>
                  </div>
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
