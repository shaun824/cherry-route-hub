// "Save for offline" card — pre-downloads village + route map tiles and the
// event's data so riders and crew can use the maps with no signal at the venue.
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CloudOff, Download, Loader2, RefreshCw, Trash2, WifiOff } from "lucide-react";
import { fetchVillageMap } from "@/lib/village-map";
import { fetchVillageTents } from "@/lib/village-tents";
import { fetchMyRooming } from "@/lib/rooming";
import {
  boundsFromPoints,
  clearOfflinePack,
  downloadOfflinePack,
  ensureOfflineWorker,
  estimateTileCount,
  formatBytes,
  readOfflineMeta,
  type Bounds,
  type LatLng,
  type OfflineMeta,
} from "@/lib/offline-pack";

type EventLike = {
  id: string;
  name?: string;
  days?: { routes?: { kmlUrls?: string[] }[] }[];
  logo_url?: string | null;
  cover_url?: string | null;
};

export function OfflinePackCard({ event }: { event: EventLike }) {
  const eventId = event.id;
  const [meta, setMeta] = useState<OfflineMeta | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; bytes: number } | null>(null);
  const [online, setOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const villageQ = useQuery({ queryKey: ["village-map", eventId], queryFn: () => fetchVillageMap(eventId) });
  const tentsQ = useQuery({ queryKey: ["village-tents", eventId], queryFn: () => fetchVillageTents(eventId) });

  useEffect(() => {
    setMeta(readOfflineMeta(eventId));
    setOnline(navigator.onLine);
    void ensureOfflineWorker();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      abortRef.current?.abort();
    };
  }, [eventId]);

  const villageBounds: Bounds | null = useMemo(() => {
    const map = villageQ.data;
    const pts: LatLng[] = [];
    if (map?.geo?.lat && map?.geo?.lng) pts.push({ lat: map.geo.lat, lng: map.geo.lng });
    for (const h of map?.hotspots ?? []) if (h.lat && h.lng) pts.push({ lat: h.lat, lng: h.lng });
    for (const z of map?.zones ?? []) for (const p of z.points ?? []) pts.push({ lat: p.lat, lng: p.lng });
    for (const t of tentsQ.data ?? []) pts.push({ lat: t.lat, lng: t.lng });
    return boundsFromPoints(pts, 0.005);
  }, [villageQ.data, tentsQ.data]);

  const files = useMemo(() => {
    const out: string[] = [];
    for (const d of event.days ?? []) for (const r of d.routes ?? []) for (const u of r.kmlUrls ?? []) out.push(u);
    if (villageQ.data?.image_url) out.push(villageQ.data.image_url);
    if (event.logo_url) out.push(event.logo_url);
    return out;
  }, [event, villageQ.data]);

  const estimate = villageBounds ? estimateTileCount(villageBounds, 13, 18) : 0;
  const busy = progress !== null;
  const ready = !!meta;

  async function run() {
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ done: 0, total: estimate + files.length, bytes: 0 });
    try {
      await ensureOfflineWorker();
      // Warm the data snapshots (these fetchers cache themselves for offline use).
      const [map, tents] = await Promise.all([fetchVillageMap(eventId), fetchVillageTents(eventId)]);
      await fetchMyRooming(eventId).catch(() => null);
      void map;
      void tents;

      const next = await downloadOfflinePack(
        { eventId, village: villageBounds, route: villageBounds, files },
        (p) => setProgress(p),
        controller.signal,
      );
      setMeta(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed — try again with better signal.");
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  }

  async function remove() {
    await clearOfflinePack(eventId);
    setMeta(null);
  }

  if (!villageBounds && files.length === 0) return null;

  const pct = progress && progress.total ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-xl bg-accent p-2 text-cherry-deep">
          {ready ? <CheckCircle2 className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">Offline mode</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
            {ready
              ? `Saved ${new Date(meta!.downloadedAt).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${meta!.tiles} map tiles · ${formatBytes(meta!.bytes)}. The village map, tents, routes and your accommodation work with no signal.`
              : "There's no cell signal at the venue. Download the village map, tent pins, route maps and your accommodation now so everything still works offline."}
          </p>

          {!online ? (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-[11px] font-semibold text-ink-soft">
              <WifiOff className="h-3 w-3" />
              You're offline{ready ? " — using your saved pack." : " — reconnect to download."}
            </p>
          ) : null}

          {busy ? (
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-cherry transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-ink-soft">
                Downloading {progress!.done}/{progress!.total} · {formatBytes(progress!.bytes)}
              </p>
            </div>
          ) : null}

          {error ? <p className="mt-2 text-[11px] font-semibold text-cherry">{error}</p> : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={run}
              disabled={busy || !online}
              className="inline-flex items-center gap-1.5 rounded-full bg-cherry px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : ready ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {busy ? "Saving…" : ready ? "Update pack" : `Save for offline${estimate ? ` (~${formatBytes(estimate * 22000)})` : ""}`}
            </button>
            {ready && !busy ? (
              <button
                type="button"
                onClick={remove}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-[11px] font-bold text-ink-soft"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
