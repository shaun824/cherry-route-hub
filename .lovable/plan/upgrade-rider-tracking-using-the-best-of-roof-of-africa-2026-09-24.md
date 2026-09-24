# Upgrade rider tracking using the best of Roof of Africa

Roof of Africa’s tracker is a branded **Traccar** deployment: React, Material UI and a MapLibre satellite map, fed by dedicated GPS devices through a live connection. It is primarily a spectator/operations map; it does not use the rider’s phone as the tracker.

Cherry Rider Hub already has the stronger rider safety foundation: phone GPS, five-second recording, offline buffering, SOS, race-control acknowledgement and escalation. The upgrade should retain that system and adopt Roof’s clearest map experience without copying its generic dark interface.

## 1. Rider tracking becomes map-first

- Make the active course map the main surface once tracking starts, with the rider clearly centred and their route visible.
- Add a compact Red Cherry tracking panel over the map: **Tracking**, GPS quality, last successful upload, battery, points waiting to upload and elapsed time.
- Replace raw latitude/longitude as the main feedback with useful race information: distance along route, percentage complete, current speed and last update. Coordinates remain available in a small details view.
- Keep a persistent **Re-centre** action when the rider pans away, matching the useful “follow me” behaviour from dedicated tracker apps.

## 2. Strong pre-start and connection states

- Before tracking, show one focused readiness screen: GPS permission, app installation/background reliability, battery, tracking opening time and distance from the event start. Only enable tracking when the rider is within 1 km of the start/race village, with a clear distance message and a retry-location action when they are outside it or GPS is unavailable.
- Tie unavailable/start-window explanations directly to the Start button instead of leaving riders to interpret a separate message.
- Give clear, distinct map states for: finding GPS, tracking normally, weak GPS, offline but safely queued, uploading queued points, stopped and finished.
- Always show upload/GPS errors after a first fix; currently some errors disappear once coordinates exist.

## 3. Preserve and strengthen SOS

- Keep the existing reason, note, two-second hold, alarm, push, acknowledgement, resolution and cancellation flow unchanged.
- Keep SOS available above the map at all times while tracking.
- Confirm whether each SOS was sent **with location** or **without a GPS fix**, with direct guidance if location was unavailable.
- Do not change the safety-critical SOS schema, race-control alarm logic or five-second recording interval in this pass.

## 4. Spectator-style rider finding

- Bring Roof’s useful search-and-follow pattern into the existing public spectator map using Red Cherry styling: search by name or race number, select a rider, follow them, and show freshness clearly.
- Keep our existing course progress, finished grouping, stale/lost-signal treatment and unclustered SOS markers; these are stronger than Roof’s generic online/offline list.
- Do not expose crew-only navigation, battery or incident controls publicly.

## 5. Mobile polish and efficiency

- Design for one-handed use: map fills the useful screen area, important controls stay thumb-reachable, and the SOS action cannot be hidden by sheets or browser safe areas.
- Coordinate the install prompts so riders see one clear warning rather than two competing messages; remind again near race time if dismissed earlier.
- Keep the existing five-second recording and batched/offline uploads. Do not adopt Roof’s hardware/Traccar backend because that would require physical trackers and a separate tracking server.

## 6. Verification

- Test the complete rider flow on phone widths: permission denied/allowed, start, pan and re-centre, weak accuracy, offline queue, reconnect/upload, stop, resume and SOS with/without a GPS fix.
- Test the public search/follow flow using Mike Glover, who is listed on Roof as **728** (726 is Craig Roy Cook).
- Check that tracking continues to upload every five seconds without one-request-per-point regressions and that race control still receives and handles alerts.
- Run the remaining real-device checks before Weekend Warrior: iPhone installed vs Safari screen-lock test and a three-to-four-hour battery test.

## Technical details

- Reuse the existing Leaflet course overlay and tracking data; no new map provider or paid routing service.
- Confine the first implementation to rider/spectator presentation and local display state. No database migration is required.
- Reuse existing progress projection, route matching, stale/lost-signal rules, offline queue and SOS server functions.
- Roof’s implementation is a Vite-built React 19 PWA using Material UI, MapLibre GL and a Traccar Java backend with REST plus `/api/socket`; its custom `/api/competitors` groups tracker devices into riders.
