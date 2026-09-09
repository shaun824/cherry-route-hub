# Rider names on the live map + one-tap "navigate to rider"

## What's wrong today

The pin says "Rider" instead of the person's name. The name lookup used by the public live map is blocked: the helper that returns the tracking riders' names, race numbers and categories is not permitted for signed-out visitors, so the lookup fails silently and every pin falls back to "Rider". Confirmed by running the helper as an anonymous caller — it is refused. The underlying data is fine (the recent tracking points do carry the rider link and the name "Shaun Michael Glover").

## The fix

1. Allow the name lookup for public viewers. That helper only ever returns people who are actively sharing their position in the last 12 hours, and only name, race number and category — exactly what the spectate page already shows.
2. Stop the failure being silent: if the name lookup ever fails again, log it server-side so it shows up instead of quietly turning everyone into "Rider".
3. Pin labels become: name, race number, category, last-seen time. If a name genuinely isn't on file, fall back to the race number, then "Rider".

## Navigate to a rider (cheap approach)

No paid mapping or routing service. When someone taps a pin they get a small popup with:

- Rider name, race number, category, and how long ago the position was reported.
- Distance and compass direction from the viewer's own location (calculated in the browser, free).
- **Navigate** button, shown to crew only, that hands the rider's coordinates to the phone's own maps app (Google Maps on Android/desktop, Apple Maps on iPhone) — a plain link, no cost, and turn-by-turn is done by the app the crew member already has. The public spectate popup has no navigate button.
- **Copy coordinates** and **Share** (crew only) so a crew member can send the position over WhatsApp/radio.
- A dashed straight line from the viewer's position to the rider while the popup is open, drawn locally on the existing map — a visual "that way, 2.4 km" cue with no extra requests.

Nothing extra is fetched per pin, so cost stays exactly where it is today.

The public spectate popup shows only name, race number, category and last-seen time. Navigate, share, copy coordinates, the distance line and battery level are crew and admin only.

## Technical notes

- Grant `EXECUTE` on `public.live_tracking_identity(uuid)` to `anon` (migration). It is `SECURITY DEFINER` and already scoped to riders with points in the last 12 hours.
- `fetchLiveTracking` in `src/lib/tracking.functions.ts`: capture and log the `rpc` error; keep the existing publishable-key client.
- `src/components/live-tracking-map-inner.tsx`: replace the tooltip-only marker with `bindPopup` content built from the rider row; add an `isCrew` prop (true only from `race-control.tsx`) gating the navigate/share/copy actions, battery line and distance polyline; use the browser `geolocation` position to compute distance/bearing and draw one reusable `L.polyline`.
- Navigation links: `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=driving`, and `maps://?daddr=` on iOS user agents.

## Also fix: embed chat button text is invisible on third-party sites

Andrew's Weekend Warrior site loads `/embed/chat` in an iframe. The parent message wrapper applies `[&_a]:text-cherry` to all links, which overrides the pill button's `text-white` because the arbitrary variant has higher specificity. The result is orange text on an orange button, and the label is clipped by `truncate`.

Fix in `src/components/embedded-assistant.tsx`:

- Change the internal link pill's text colour to `!text-white` so it wins over the parent rule.
- Remove `truncate` from the button label (or replace with `whitespace-nowrap`) so short labels like "Your Events Hub" aren't clipped.

No other UI or behaviour changes.
