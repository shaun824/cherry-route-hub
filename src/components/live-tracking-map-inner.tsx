// Live spectator map: polls for the latest rider positions every 15s and plots
// them on a Leaflet map. Public — uses the same read path as the spectate page.
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import { fetchLiveTracking } from "@/lib/tracking.functions";
import { MapPin } from "lucide-react";

const POLL_MS = 15_000;
const STALE_AFTER_MS = 5 * 60_000;

function markerIcon(stale: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:18px;height:18px;border-radius:9999px;
      background:${stale ? "#9ca3af" : "#e11d48"};
      border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export default function LiveTrackingMapInner({ eventId }: { eventId: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const fittedRef = useRef(false);
  const [follow, setFollow] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data } = useQuery({
    queryKey: ["live-tracking", eventId],
    queryFn: () => fetchLiveTracking({ data: { eventId } }),
    refetchInterval: POLL_MS,
  });

  const riders = useMemo(() => data?.riders ?? [], [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return riders;
    return riders.filter(
      (r) =>
        (r.riderName ?? "").toLowerCase().includes(q) ||
        (r.bib ?? "").toLowerCase().includes(q),
    );
  }, [riders, search]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView([-29.5, 24.5], 6);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    const now = Date.now();
    const bounds: [number, number][] = [];

    for (const r of riders) {
      seen.add(r.userId);
      const stale = now - new Date(r.recordedAt).getTime() > STALE_AFTER_MS;
      const label = r.riderName ?? "Rider";
      const sub = [
        r.bib ? `#${r.bib}` : null,
        r.category ?? null,
        new Date(r.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      ]
        .filter(Boolean)
        .join(" · ");
      const existing = markersRef.current.get(r.userId);
      if (existing) {
        existing.setLatLng([r.lat, r.lng]);
        existing.setIcon(markerIcon(stale));
        existing.setTooltipContent(`<strong>${label}</strong><br/>${sub}`);
      } else {
        const m = L.marker([r.lat, r.lng], { icon: markerIcon(stale) })
          .addTo(map)
          .bindTooltip(`<strong>${label}</strong><br/>${sub}`, { direction: "top" });
        markersRef.current.set(r.userId, m);
      }
      bounds.push([r.lat, r.lng]);
      if (follow === r.userId) map.panTo([r.lat, r.lng]);
    }

    // Remove markers for riders no longer reporting.
    for (const [id, m] of markersRef.current) {
      if (!seen.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    }

    if (!fittedRef.current && bounds.length > 0 && !follow) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.15));
      fittedRef.current = true;
    }
  }, [riders, follow]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a rider by name or race number…"
          className="w-full rounded-xl bg-card px-3 py-2 text-sm text-ink ring-1 ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cherry"
        />
      </div>
      {search.trim() ? (
        <div className="flex flex-wrap gap-1.5">
          {filtered.slice(0, 8).map((r) => (
            <button
              key={r.userId}
              type="button"
              onClick={() => {
                setFollow(r.userId);
                const map = mapRef.current;
                if (map) map.setView([r.lat, r.lng], Math.max(map.getZoom(), 14));
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition-colors ${
                follow === r.userId
                  ? "bg-cherry text-white ring-cherry"
                  : "bg-card text-ink ring-border hover:bg-accent"
              }`}
            >
              {r.riderName ?? "Rider"}
              {r.bib ? ` · #${r.bib}` : ""}
            </button>
          ))}
          {follow ? (
            <button
              type="button"
              onClick={() => setFollow(null)}
              className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
            >
              Stop following
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        ref={containerRef}
        className="h-96 w-full overflow-hidden rounded-2xl ring-1 ring-border"
      />
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 text-cherry" />
        {riders.length > 0
          ? `${riders.length} rider${riders.length === 1 ? "" : "s"} tracking · updates every 15 seconds`
          : "No riders are sharing their position yet — dots appear here once riders start tracking."}
      </p>
    </div>
  );
}
