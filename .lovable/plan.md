# Clean embed route for the Race Village map

Andrew needs an iframe-safe URL that renders only the village map — no cover photo, no AI assistant, no bottom nav, no sign-in prompt.

## What gets built

A new public route: `/embed/village/{eventId}`

It renders the existing interactive village map (satellite base, pins, category/layer filters, venue picker when the event has more than one village) full-bleed inside the iframe, in rider-only mode so no crew build detail can leak even if a crew member happens to be signed in.

Everything else the current app link pulls in is skipped: no header/cover, no bottom tab bar, no assistant widget, no sign-in banner, no footer, no set-password prompt, no pull-to-refresh chrome.

Optional query flags for the web team:
- `?venue={venueId}` — open a specific village on multi-venue events
- `?layers=rider` (default) — reserved for future layer presets

## Answers for Andrew

- Lourensford 2026 embed URL (once this ships):
  `https://riderapp.redcherryevents.co.za/embed/village/2dc4fd8c-c1f0-45b3-b5cd-61a3644f7fa7`
- Grabouw: there is no Grabouw 2027 event in the system, and Otto1890 Weekend Warrior Grabouw 2026 has no village map built yet. Keep the illustrated 2D schematic as the Grabouw default; the same embed URL pattern will work the moment a Grabouw village map is drawn.

## Technical notes

- New file `src/routes/embed.village.$eventId.tsx` with `createFileRoute("/embed/village/$eventId")`.
- `src/routes/__root.tsx` currently wraps everything in `AppShell` unless the path is admin. Add `/embed` to that bypass so embed routes render bare `<Outlet />`, and exclude `/embed` from `SetPasswordPrompt` (same list that already excludes `/auth`, `/reset-password`, `/crew`).
- Reuse `VillageMapView` with `riderOnly` and `venueId` from the search params; wrap in a `h-[100dvh] w-full` container so the map fills the iframe.
- Data is already anon-readable (`events`, `event_venues`, `event_village_maps`, `event_village_tents` all have public SELECT policies), so no auth and no schema change is needed.
- `head()` sets a route-specific title/description plus `robots: noindex` — the embed shouldn't compete with real pages in search.
- Verify the published response allows framing from `redcherryevents.co.za`; if a frame-blocking header is present, the embed route serves a permissive `Content-Security-Policy: frame-ancestors` instead.
- Sanity check in preview at 390px and desktop width, plus a local test HTML page with the route in an iframe.
