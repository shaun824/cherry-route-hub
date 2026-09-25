# Infrastructure Rental jobs

A second kind of event for hiring out Red Cherry infrastructure (weddings, corporate days, other clients' events), built on the same tools you already use for races.

## What you get

**Super admin: Admin → Rentals (new)**
- Create a rental job: client name, contact person, venue/location, build date, event date(s), breakdown date, notes, cover photo.
- "Show publicly" switch per job (off by default) — when off, it never appears in the rider app, home page or event lists.
- "Copy client link" — only super admins see this. Link looks like `/rental/<private-code>`; anyone with it can view, nobody can guess it. "Reset link" makes the old one stop working.
- From the job you jump straight into the tools you already know: village map editor (build the crew village at their location), run sheet, and equipment list.

**Client page (no sign-in, via the link)**
- Cover, client/event name, venue, dates (build, event, breakdown), contact and notes.
- Venue map — rider-facing points only (no crew notes, specs or build layers).
- Run sheet — the timeline for their event.
- Equipment list — what's being rented (item, size, quantity). No prices, no internal notes.
- Clean page: no bottom nav, no rider sign-in prompts, no assistant.

**Crew: new "Rentals" tab in the crew portal**
- Lists upcoming rental jobs separately from race events.
- Each job opens its build map (all layers), run sheet and packing/load-out checklist, same as race events.

## Technical details

- Reuse the `events` table so village map, run sheet, inventory bookings and packing work unchanged. Additive migration:
  - `events.event_type text not null default 'race'` (`'race' | 'rental'`)
  - `events.is_public boolean not null default true` (rentals created with false)
  - `events.share_token text unique` (random, super-admin generated)
  - `events.client_name`, `client_contact`, `build_date date`, `breakdown_date date`
- Public event lists (home, events, my-events, spectate, entry-count, sitemap-ish queries) filter `event_type='race' OR is_public`.
- Client page `src/routes/rental.$token.tsx` loads through a public server function that looks up by `share_token` and returns only safe fields: event info, rider-layer village points, run sheet rows, and equipment (name/size/qty from `event_branding_bookings`). `head()` sets `robots: noindex`. Added to the app-shell bypass like `/embed`.
- Share token generate/reset is an admin-only server function (`has_role` admin check).
- `src/routes/admin.rentals.tsx` (list + create/edit form), linked in the admin nav; buttons link to existing `/admin/village/$eventId`, `/admin/run-sheet`, and inventory with the event pre-selected.
- `src/routes/crew.rentals.tsx` lists `event_type='rental'` events; existing crew event pickers (build, run sheet, inventory) accept rentals via `?event=`.
- No changes to riders, entries, tracking or emails; rentals never enter email workflows.
- Verify: create a test rental, add a map point + run sheet row + equipment, open the client link signed-out, confirm it's hidden from public lists, then delete the test job.
