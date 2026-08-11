# Open every event page to the public, with locked sections

Turn the rich event page into a public knowledge hub: anyone (signed in or not) can open any published event and read the full detail. Sensitive or personal parts stay visible but greyed out with a sign-in prompt.

## What visitors see

Public to everyone:
- Event hero: name, date, location, discipline, description
- Full schedule (day tabs, times, details)
- Venue info, parking, packing list (read-only), rules/waivers, FAQs, emergency contacts
- Route list: day, route name, distance, elevation, description
- News feed for the event
- Sponsors tab (title, partners, supporters)
- Ask-the-assistant and event chat stay visible but disabled with a "Sign in to ask" prompt (unchanged from today)

Locked (visible but blurred/greyed, with a "Sign in to unlock" overlay):
- Interactive route map and GPX/KML downloads
- "Your entry" card: category, batch, bib, apparel, merchandise/extras, registration link, report button
- Rooming / tent numbers
- Start lists and entrant names on the Spectate pages

## How it works

1. Event browsing
   - `/events` and `/events/$eventId` become the public entry points and link through to the full event page for every published event.
   - `/my-events/$eventId` no longer assumes the viewer is an entrant. The page loads event data for anyone (the events, event info, venues and feed tables already allow public reads); entrant-only queries only run when signed in.
   - `/my-events` keeps its current signed-out state but gains a link to browse all events.

2. Locking pattern
   - Add a small `LockedSection` component: renders children blurred and non-interactive behind a translucent overlay with a lock icon, short line of copy, and a "Sign in" button that returns to the same event page after login.
   - Wrap the route map, download buttons, entry card, rooming block and start lists with it, keyed off `useSession()`.
   - Keep the summary text (route name, distance, elevation) outside the lock so the page still reads as useful knowledge.

3. Discovery and SEO
   - Give the event page its own `head()` with the event name, location and date so shared links preview properly.

## Technical notes

- No database or policy changes needed: `events`, `event_info_blocks`, `event_venues` and `feed_posts` already have public read policies; entrant, rooming and chat tables stay locked down by RLS, so the greying out matches what the backend already enforces.
- Files touched: `src/routes/my-events.$eventId.tsx` (make guest-safe, wrap locked blocks), `src/routes/events.index.tsx` and `src/routes/events.$eventId.index.tsx` (link into the full page), `src/routes/spectate.$eventId.tsx` (lock start lists), plus a new `src/components/locked-section.tsx`.
- Guest queries for entry/rooming data are skipped entirely rather than failing silently, so no console errors for signed-out visitors.
