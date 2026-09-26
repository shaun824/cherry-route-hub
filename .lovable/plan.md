# Bring the PE Plett journey into Rider Hub

## Goal
Turn the PE Plett **Routes** section into the app version of the website’s 2027 journey, while keeping the familiar Weekend Warrior route-page structure and controls.

## What riders will see
- A PE Plett journey header using the event’s deep teal and M&G green, with the four-stage overview: **262 km, 4,016 m climbing, St Francis Links to Nature’s Valley**.
- Four easy day selectors for:
  1. **St Francis Kick Off** — St Francis Links to Fynbos Ridge
  2. **Ridge Lines** — Fynbos Ridge to Tsitsikamma Lodge
  3. **Tranquil Trails** — Tsitsikamma Lodge loop
  4. **Victory Ride** — Tsitsikamma Lodge to Nature’s Valley
- A lightweight animated journey overview that draws the route stage by stage and lets riders replay it or jump to a stage.
- Each stage presented in the same clear pattern as Weekend Warrior: map, distance and climbing, route profile, stage story, start/finish, and “along the way” points.
- PE Plett route and lifestyle images from the official website, stored with the app rather than linked remotely.
- Sponsor-led route points and colours carried across where the website specifies them, including M&G Investments, ECM/Ford sections, Boost Bars, and waterpoint partners.
- The existing fullscreen map and route-download access rules remain unchanged.

## Interaction and visual direction
- Keep the Weekend Warrior mobile-first layout, spacing, route cards, elevation profiles, and day switching so riders already know how to use it.
- Give PE Plett its own identity through deep teal, M&G green, coastal photography, stage-colour route lines, and restrained motion.
- Animate the route only when it enters view; pause it off-screen, provide replay/stage controls, and respect reduced-motion settings.
- Make map/profile hover or touch continue to identify the matching point on the route.
- Load heavier map content only when needed and retain a static stage-image fallback on slower phones.

## Content and data
- Copy the published 2027 stage names, figures, descriptions, start/finish venues, highlights, and sponsor points from the official PE Plett journey page.
- Import the official route overview and Stage 1–4 images through the app’s asset flow.
- Extract and reuse the website’s published route geometry for all four stages so the animated overview and interactive maps represent the same journey.
- Update only the 2027 PE Plett event record; Weekend Warrior and other events remain unchanged.
- Treat the website as the current source for this journey. Preserve the app’s existing rider-only protection for downloadable route files.

## Technical details
- Add a PE Plett journey presentation component that sits above the existing generic route-day cards only for the PE Plett event.
- Reuse the existing route map, elevation profile, marker, fullscreen, and day-filter components rather than duplicating the Weekend Warrior system.
- Extend the event route data with the four published stages, route colours, geometry/files, stage imagery, descriptions, and named points.
- Keep PE Plett styling behind semantic event-specific tokens/classes so the global Red Cherry theme does not change.
- Add a recorded database migration for the PE Plett event-data update and preserve all current event fields not related to the journey.

## Verification
- Check all four stages on phone and desktop sizes.
- Confirm stage selector, replay, map movement, profile scrubbing, fullscreen map, sponsor points, and reduced-motion behavior.
- Confirm the PE Plett route tab uses the new content while Weekend Warrior still renders exactly as before.
- Confirm route images and maps have stable loading/fallback states and no page overlap or horizontal scrolling.
