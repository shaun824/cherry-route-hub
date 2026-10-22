// Animated chevrons that flow along route lines in their riding direction.
// Plain Leaflet so both the rider route map and the live race-control map share it.
import L from "leaflet";

export function addDirectionArrows(map: L.Map, lines: { color: string; coords: [number, number][] }[]): () => void {
  const layer = L.layerGroup().addTo(map);
  type Track = { cum: number[]; pts: L.LatLng[]; total: number; markers: { m: L.Marker; el?: HTMLElement }[] };
  const tracks: Track[] = [];
  const kmMarkers: { m: L.Marker; km: number }[] = [];
  const kmLayer = L.layerGroup().addTo(map);
  for (const l of lines) {
    if (l.coords.length < 2) continue;
    const pts = l.coords.map(([lat, lng]) => L.latLng(lat, lng));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i - 1].distanceTo(pts[i]));
    const total = cum[cum.length - 1];
    if (total < 50) continue;
    const n = Math.max(2, Math.min(12, Math.round(total / 3500)));
    const markers = Array.from({ length: n }, () => ({
      m: L.marker(pts[0], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "",
          iconSize: [14, 14],
          iconAnchor: [7, 7],
          html: `<div data-arrow style="width:14px;height:14px;opacity:.9;display:grid;place-items:center;border-radius:9999px;background:${l.color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"><svg width="8" height="8" viewBox="0 0 24 24"><path d="M12 3 L21 19 L12 14 L3 19 Z" fill="#fff"/></svg></div>`,
        }),
      }).addTo(layer),
    })) as Track["markers"];
    tracks.push({ cum, pts, total, markers });
    // Distance markers every 5 km so riders can see how far along they are.
    for (let km = 5; km * 1000 < total - 300; km += 5) {
      const d = km * 1000;
      let i = 1;
      while (i < cum.length - 1 && cum[i] < d) i++;
      const f = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      const a = pts[i - 1];
      const b = pts[i];
      const m = L.marker(L.latLng(a.lat + (b.lat - a.lat) * f, a.lng + (b.lng - a.lng) * f), {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "",
          iconSize: [34, 18],
          iconAnchor: [17, 9],
          html: `<div style="height:18px;min-width:34px;padding:0 5px;display:flex;align-items:center;justify-content:center;border-radius:9999px;background:#fff;color:#111;border:2px solid ${l.color};font:800 10px/1 system-ui,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.35);white-space:nowrap">${km} km</div>`,
        }),
      });
      kmMarkers.push({ m, km });
    }
  }
  // Keep it calm: hidden when zoomed far out, every 10 km at mid zoom, every 5 km close in.
  const syncKm = () => {
    const z = map.getZoom();
    for (const { m, km } of kmMarkers) {
      const show = z >= 13 || (z >= 11 && km % 10 === 0);
      if (show && !kmLayer.hasLayer(m)) kmLayer.addLayer(m);
      else if (!show && kmLayer.hasLayer(m)) kmLayer.removeLayer(m);
    }
  };
  syncKm();
  map.on("zoomend", syncKm);
  const at = (t: Track, d: number) => {
    let lo = 0;
    let hi = t.cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (t.cum[mid] <= d) lo = mid;
      else hi = mid;
    }
    const a = t.pts[lo];
    const b = t.pts[hi];
    const f = (d - t.cum[lo]) / (t.cum[hi] - t.cum[lo] || 1);
    const pa = map.project(a);
    const pb = map.project(b);
    const ang = (Math.atan2(pb.x - pa.x, pa.y - pb.y) * 180) / Math.PI;
    return { ll: L.latLng(a.lat + (b.lat - a.lat) * f, a.lng + (b.lng - a.lng) * f), ang };
  };
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  let last = 0;
  const start = performance.now();
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (now - last < 60) return;
    last = now;
    const phase = reduce ? 0 : ((now - start) / 6000) % 1;
    for (const t of tracks) {
      const gap = t.total / t.markers.length;
      t.markers.forEach((mk, i) => {
        const { ll, ang } = at(t, ((i + phase) * gap) % t.total);
        mk.m.setLatLng(ll);
        mk.el ??= (mk.m.getElement()?.querySelector("[data-arrow]") as HTMLElement | null) ?? undefined;
        if (mk.el) mk.el.style.transform = `rotate(${ang}deg)`;
      });
    }
  };
  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    layer.remove();
    map.off("zoomend", syncKm);
    kmLayer.remove();
  };
}
