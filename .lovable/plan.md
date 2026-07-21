
## Goals
1. Home page stops pushing entries and pushes riders to **My Events**.
2. Signed-out home = big "Sign in to see your events" CTA.
3. Each My Event page shows a **rider report**: everything Red Cherry has on file for that rider on that event (category, batch, bib, sizes, extras, emergency contact) + a way to view/download it.
4. Extras (jackets, T-shirts, add-ons purchased on Entry Ninja) get stored per event-entrant so they can appear in the report.

## 1. Home page redesign (`src/routes/index.tsx`)

Replace current layout with a session-aware home:

**Signed out** → hero + one giant CTA card:
- Big "Sign in to see your events" panel (icon, headline, subtext, cherry-gradient "Sign in with Google" button linking to `/auth?next=/my-events`).
- Below it: latest news preview + sponsor scroller (public, no entry CTAs).
- No "Upcoming events" carousel, no RSVP buttons.

**Signed in** → "your next event" focused:
- Loyalty strip stays.
- **Next event countdown card** (new hero component): pulls the rider's linked events via `fetchMyEvents()`, picks the soonest future one, and renders:
  - Event name + discipline, hero gradient / cover image.
  - Big "**14 days to go**" (or "Today" / "Live now" / "Tomorrow") computed from `event_date`.
  - Date, venue (tap → Google Maps), category/batch/bib chips.
  - Primary CTA: "**Open my event →**" → `/my-events/$eventId`.
- **My events shortcuts row** (if 2+ linked events): horizontal scroller of remaining events, each linking to `/my-events/$eventId`.
- If linked but no events yet: friendly empty state pointing at admin.
- If signed in but not linked: existing `LinkEntrantForm` inline nudge → `/my-events`.
- Keep pinned notice, latest news preview, promo teaser, sponsor scroller.
- Remove the current "Upcoming events" carousel with RSVP/Details buttons (that flow is gone since entries go through Entry Ninja).

Quick links row: keep, but drop any entry-oriented link defaults from settings on first render (leave admin-managed).

## 2. Rider event report

### 2a. Store extras per entry
Add JSONB `extras` to `event_entrants` so imports/webhooks can attach add-ons.

```sql
ALTER TABLE public.event_entrants
  ADD COLUMN extras jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN jacket_size text,
  ADD COLUMN tshirt_size text,
  ADD COLUMN notes text;
```

Shape for `extras`: `[{ name: string, qty: number, size?: string, price?: number }]`.

Update `src/lib/my-events.ts` to select these columns and surface them in `MyEventRow`.

### 2b. Admin roster importer (`src/routes/admin.roster.tsx`)
Extend the CSV importer to accept optional columns: `jacket_size`, `tshirt_size`, `extras` (JSON string or `"Jacket M x1; Buff x2"` shorthand parsed into the JSONB shape), `notes`. Existing rows update in place. Also add an inline editor on each event-entrant row so admins can adjust after Entry Ninja sync.

### 2c. Rider report on `/my-events/$eventId`
Add a new **"Your entry"** card at the top of the info tab (above Venue), rendered from the loader's `event_entrants` row:
- Full name, email (from `entrants`).
- Category, batch, bib.
- Jacket size, T-shirt size.
- Extras list with qty/size.
- Emergency contact from profile (already in `profiles`).
- "Something wrong? Contact admin" link → existing admin QA thread.
- "**Download report (PDF)**" button — uses `window.print()` on a print-styled report route `/my-events/$eventId/report` that renders the same data in a clean A4 layout (no PDF lib needed; browser print-to-PDF).

Also add a compact "Your entry" summary chip strip on `/my-events` list (already partially there — extend with jacket/T-shirt icons when present).

## 3. Not in scope
- No Entry Ninja API/webhook wiring this turn (extras field is ready for it; admins fill via CSV/inline for now).
- No changes to the public events index or entry flow (still hidden).
- No changes to admin events editor's schedule/routes.

## Files touched
- `src/routes/index.tsx` — full rewrite of the home layout.
- `src/lib/my-events.ts` — select `extras`, `jacket_size`, `tshirt_size`, `notes`; extend type.
- `src/routes/my-events.$eventId.tsx` — new "Your entry" card + print button.
- `src/routes/my-events.report.$eventId.tsx` (new) — print-friendly report page.
- `src/routes/admin.roster.tsx` — CSV columns + inline extras editor.
- Migration: add columns to `event_entrants`.

## Technical notes
- The home "next event" logic runs client-side after `useSession()` resolves; no SSR of protected data.
- Countdown uses `Math.ceil((eventDate - now) / 86400000)` with "Today" / "Tomorrow" / "Live" (when between start and start+event length) special cases.
- Print report uses `@media print` CSS in `src/styles.css` and a minimal route component; no new deps.
