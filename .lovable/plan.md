## What you'll get

- Admin can upload one or more **KML files per route** (Gold/Silver/Bronze) on every event day.
- Riders see an **interactive map** on the public event page and on their My Events page — pan/zoom, click placemarks to see labels/descriptions, toggle routes on/off.
- Below the map: **total distance**, **total elevation gain**, and a small **elevation profile chart**.
- A **"View fullscreen"** button opens an immersive route page (`/events/:id/map`) that fills the screen on mobile.

## Setup you need to do once

Google Maps Platform must be connected so I can fetch elevation for KML tracks that don't include altitude. I'll walk you through connecting the managed Lovable key — one click, no Google Cloud account needed. If you'd rather skip elevation for now, tell me and I'll ship the map with distance only.

## Build steps

1. **Storage & schema**
   - Create a private `event-kmls` storage bucket with admin-write / signed-read RLS policies (mirrors your existing `event-images` bucket).
   - Extend the `EventRoute` type (already stored inside `events.days` JSONB — no migration needed) with `kmlUrls: string[]` and cached `distanceKm` / `elevationM` derived on save.

2. **Admin editor** (`src/routes/admin.events.tsx`)
   - In the Days → Routes section, add a "KML files" area per route with drag-and-drop upload, thumbnail list, and delete button.
   - On upload, parse the KML client-side to fill in distance/elevation preview so admins see it before saving.

3. **Map component** (`src/components/route-map.tsx`)
   - Uses **Leaflet + react-leaflet** with OpenStreetMap tiles (no key, free).
   - Loaded through `<ClientOnly>` + `React.lazy` so SSR doesn't break.
   - Parses KMLs with `@tmcw/togeojson`; renders LineStrings as coloured polylines (Gold=amber, Silver=slate, Bronze=copper), and Placemarks as clickable pins with popup name/description.
   - Auto-fits bounds to visible routes. Route toggle chips top-left, legend + stats top-right.

4. **Distance & elevation**
   - Distance computed from LineString coordinates using the haversine formula (no API call).
   - Elevation: if KML has altitude → use it. If missing → call a new server function `getRouteElevation` that hits Google Maps Elevation API through the connector gateway (server-side, secret key), samples ~200 points along the path, returns the profile. Result cached on the route row so we don't re-query.
   - Elevation profile rendered as a small SVG sparkline under the map; total gain displayed as a stat.

5. **Public & rider pages**
   - `src/routes/events.$eventId.index.tsx`: embed `<RouteMap event={event} height="360px" />` in the itinerary section, with "View fullscreen" link.
   - `src/routes/my-events.$eventId.tsx`: same component, above the packing list.
   - `src/routes/events.$eventId.map.tsx` (new): fullscreen map route — map fills viewport minus a slim top bar with event name, route toggle, distance/elevation stats, and a back button.

## Dependencies

`leaflet`, `react-leaflet`, `@tmcw/togeojson`, `@types/leaflet`.

## Not included in this pass

- Real-time rider position on the map (that's the separate SOS/tracker feature).
- Downloadable GPX (kept for a follow-up if you want it).
- Turn-by-turn directions.

## Order of operations

1. Ask you to connect Google Maps Platform (one click) — or confirm distance-only.
2. Create the storage bucket + RLS.
3. Install deps.
4. Build the map component + elevation server function.
5. Wire admin upload UI.
6. Wire the map into the two event pages + the new fullscreen route.
7. I'll walk you through uploading a test KML to verify.

Say **"go"** to start, or tell me to change anything.