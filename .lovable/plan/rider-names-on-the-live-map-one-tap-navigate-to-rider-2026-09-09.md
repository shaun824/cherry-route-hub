# Rider names on the live map + one-tap "navigate to rider"

## What's wrong today

Pins say "Rider" instead of the person's name. The name lookup used by the public live map is refused for signed-out visitors, so it fails silently and every pin falls back to "Rider". The underlying data is fine — recent tracking points carry the rider link and the name.

## The fix

- Allow the name lookup for public viewers. It only returns people actively sharing their position in the last 12 hours, and only name, race number and category — exactly what the spectate page already shows.
- Stop the failure being silent: log the lookup error server-side instead of quietly turning everyone into "Rider".
- Pin labels become: name, race number, category, last-seen time. Fall back to race number, then "Rider".

## Navigate to a rider (cheap approach)

No paid mapping or routing service. Tapping a pin opens a small popup with:

- Rider name, race number, category, and how long ago the position was reported.
- Distance and compass direction from the viewer's own location (calculated in the browser, free).
- **Navigate** button, crew only, handing the rider's coordinates to the phone's own maps app (Google Maps on Android/desktop, Apple Maps on iPhone). The public spectate popup has no navigate button.
- **Copy coordinates** and **Share** (crew only) for WhatsApp/radio.
- A dashed straight line from the viewer's position to the rider while the popup is open, drawn locally — a "that way, 2.4 km" cue with no extra requests.

Nothing extra is fetched per pin, so cost stays where it is today. The public popup shows only name, race number, category and last-seen time; navigate, share, copy, the distance line and battery level are crew/admin only.

## Technical notes

- Migration: `GRANT EXECUTE ON FUNCTION public.live_tracking_identity(uuid) TO anon;` — it is SECURITY DEFINER and already scoped to riders with points in the last 12 hours.
- `fetchLiveTracking` in `src/lib/tracking.functions.ts`: capture and log the rpc error; keep the existing publishable-key client.
- `src/components/live-tracking-map-inner.tsx`: replace the tooltip-only marker with `bindPopup` content built from the rider row; add an `isCrew` prop (true only from `race-control.tsx`) gating navigate/share/copy, battery line and distance polyline; use browser geolocation to compute distance/bearing and draw one reusable `L.polyline`.
- Navigation links: `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=driving`, and `maps://?daddr=` on iOS user agents.
