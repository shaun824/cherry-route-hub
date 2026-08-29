# Fix slow pinch/scroll zoom on the village map (laptop)

## Cause

In `src/components/village-map-geo.tsx` the map is configured with values that deliberately damp zooming, which is exactly what a laptop pinch (sent to the page as wheel events) feels:

- `wheelPxPerZoomLevel={220}` — Leaflet's default is **60**. 220 means you must scroll/pinch almost 4× as far to change one zoom level.
- `zoomDelta={0.35}` — the zoom step used by the +/− buttons is about a third of Leaflet's default of 1, so buttons also feel sluggish.

Mobile touch pinch felt fine because `touchZoom` uses direct finger distance, not these values — which is why the problem only shows on a laptop.

## Change (one file, config only)

In `src/components/village-map-geo.tsx`, on the `MapContainer`:

- Set `wheelPxPerZoomLevel` from **220 → 80** (slightly calmer than Leaflet's default 60 so it stays smooth with `zoomSnap={0}` fractional zoom, but fast).
- Set `zoomDelta` from **0.35 → 0.75** so the on-map +/− buttons make visible progress per click.
- Keep `zoomSnap={0}`, `zoomAnimation`, `touchZoom`, and the rotate settings unchanged — the smooth fractional zoom and the two-finger-rotate fix stay as they are.

No data, layout, or mobile behaviour changes; this only affects zoom speed/feel on the village map.

## Verification

- Typecheck passes.
- Quick check in the preview that the map still renders and zoom controls respond.
