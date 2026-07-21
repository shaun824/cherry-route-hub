## Goal

Reframe the third bottom-nav slot from **Tracker** (mock rider tool) to **Spectate** (public event browser for supporters). Move rider tracking + SOS into the per-event My Events page, where it only appears when that event is live.

## Changes

### 1. Data model
- Add `spectator_mode boolean not null default false` to `public.events`.
- Admin editor (`admin.events.tsx`): new toggle "Open to spectators" in the event form, saved alongside status.

### 2. New Spectate tab
- Replace `src/routes/tracker.tsx` with `src/routes/spectate.tsx` (keep old file until routes swap to avoid dead links).
- Lists **all non-archived events**, ordered by date.
- Each card shows: event name, date, location, discipline, live countdown.
- Card is **clickable only when `spectator_mode = true`**. Otherwise renders as a locked tile with a small "Opens closer to race day" hint and a subtle lock glyph — no navigation.
- Unlocked cards link to a new **public spectator view** `src/routes/spectate.$eventId.tsx` (lean version of the current event page: hero, venue map, schedule, routes, sponsors, socials — no rider-private data, no chat, no report).
- Header pill filter: **Upcoming / Live** (Live = `status = 'live'`).

### 3. Bottom nav
- `src/components/app-shell.tsx`: swap the Tracker tab for Spectate (icon: `Binoculars` or `Eye`, label "Spectate"). Update the match predicate to `/spectate`.
- **Remove the floating SOS button** from `app-shell.tsx` — it no longer belongs at the app-shell level.

### 4. Rider tracking moves into My Events
- Add a `TrackerPanel` section to `src/routes/my-events.$eventId.tsx`, rendered only when the event's `status === 'live'`.
- Panel contains: Start/Stop live tracking, current GPS card, and the prominent SOS button (same behaviour as today's tracker page).
- When the event isn't live yet, show a small muted note: "Tracking activates on race day."

### 5. Cleanup
- Delete `src/routes/tracker.tsx` once Spectate is wired and nothing links to `/tracker`.
- Update any remaining links (search for `to="/tracker"`).

## Technical notes

- `spectator_mode` migration includes the toggle only; no new tables, no new policies (existing events SELECT policy already covers reads).
- Spectator view reuses existing components (`RouteMap`, sponsor scroller, venue embed) but is a separate route so we can trim it independently from the rider-owned My Events page.
- Countdown logic already exists on Home — extract into a small `useCountdown(date)` hook in `src/lib/utils.ts` and reuse on Spectate cards.
- Tracker panel reuses the geolocation + SOS logic lifted from `tracker.tsx` into a new `src/components/tracker-panel.tsx` for clean removal of the old route.

## Overall app take

The app is in a strong spot: Home → My Events → Report is a clean rider funnel, admin coverage is broad, and the sponsor/socials work adds real value. Two lingering rough edges beyond this plan: (1) mock data still bleeds into a few components via `src/lib/mock-data.ts` — worth a follow-up pass to fully cut over to Supabase-hydrated state; (2) the packing-checklist and chat features are built but under-surfaced on the event page — a small "What's here" strip on My Events could lift engagement. Happy to line those up as separate plans after Spectate lands.
