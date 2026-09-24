# Full-screen live map, route picker, favourites and auto-stop tracking

## Why it showed "Bronze — Day 2"
Today isn't a race day, so the map considers every route on both days. The only rider on course is an admin test with no race class, so the system falls back to "whichever route line is closest to the dot" — Bronze Day 2 starts nearest to where the test was sitting. On race day it filters to that day, but it still guesses when a class is missing. The fix below makes the route come from the rider's entry first, and lets people change it.

## 1. Route overlay: rider's own route first, then pick more
- Each rider's route comes from their entry class (Gold/Silver/Bronze, E-Bike, day-pass distance) on today's day.
- When following a rider, show their route boldly; other routes hidden.
- A "Routes" button opens a picker listing every route for the day (and a Day switch), each with its colour swatch and a tick. Tap to add/remove overlays. "Reset to rider's route" restores the default.
- If a rider has no class, show "Route unknown — choose below" instead of silently guessing.
- Choices are remembered on that phone per event.

## 2. Full-screen map (Roof-style layout, Red Cherry look)

```text
+--------------------------------------+
| [x]  Weekend Warrior · Day 1  [Routes]|  top bar (safe-area aware)
|                                      |
|              MAP (full)              |
|                        [+][-]        |
|                        [Re-centre]   |
|--------------------------------------|
|  ===  drag handle                    |  bottom sheet, 3 heights:
|  [Search name or race no.       ]    |   peek / half / full
|  [All] [Favourites *] [Finished]     |
|  * Mike Glover   #728  Bronze  12s   |
|    62% · 18.4 km · 21 km/h           |
|    Craig Roy Cook #726 Silver  3 min |
+--------------------------------------+
```
- "Full screen" button on the map on the Live tab and spectator page; exits with X, Escape or phone back.
- Tapping a rider: map follows them, their route overlays, sheet drops to peek showing a rider card (name, number, class, progress %, distance, speed, last seen, star).
- Freshness chips: live / few minutes ago / signal lost; SOS riders always pinned to the top for crew (never shown publicly as incident controls).
- Opens full screen directly from shared links.

## 3. Favourite riders
- Star on every rider row and rider card.
- Favourites tab in the sheet; favourites get a small star on their map marker and appear first in search.
- Saved on the phone (no sign-in needed); signed-in users also keep them across devices.

## 4. Riders stop tracking at the finish
- When a tracking rider comes within ~50 m of the end of their route after covering at least 90% of it, tracking stops automatically, uploads the last points, and shows "You've finished — tracking stopped".
- Also stops when their own finish time arrives from results (existing behaviour kept).
- 18:00 daily cut-off stays.

## 5. Tests never run forever
- Every tracking session has a hard limit: admins/crew and any session outside the race window stop after 3 hours; race-day riders are capped at 12 hours as a safety net.
- A warning 10 minutes before the limit with "Keep tracking" (riders only).
- Race control can see and stop stale sessions; the server also ignores points from sessions past their limit, so a forgotten phone can't keep costing.

## Technical details
- Route mapping: extend `tracking-route-overlay.ts` with `routeForCategory(event, category, dayId)`; the map takes `selectedRouteIds` state (localStorage `rc-routes:{eventId}`), defaulting to the followed rider's route.
- Full screen: new `LiveMapFullscreen` wrapper (fixed inset-0, `useLockPageZoom`, history entry for back), reusing `live-tracking-map-inner` with a sheet component; used from `my-events.$eventId.tsx` Live tab and `spectate.$eventId.tsx`.
- Favourites: localStorage `rc-fav:{eventId}`; optional sync via a small `rider_favourites` table (user_id, event_id, entrant_id) with RLS scoped to `auth.uid()` — the only migration.
- Finish detection in `tracker-panel.tsx` using existing `progressOnCourse` (pct ≥ 0.9 and within 50 m of route end), then existing `stopTracking()`.
- Session cap: start time stored locally; client auto-stop; `tracking.functions.ts` rejects uploads when the session started >3 h ago for admin/crew roles (>12 h otherwise).
- Five-second recording, batching, SOS flow and race-control alarm untouched.
