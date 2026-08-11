# Better merchandise, extras and package details

## What's wrong now

Your Tour de Addo entry currently holds one extra literally named "7011" (a raw Entry Ninja value, not a product), so the card shows a meaningless line. Across other riders the data is real but raw: names like "Double - Luxury tent for 2 nights" with an option value of "Yes I want this" rendered as if it were a size, and no prices (Entry Ninja isn't returning them on these lines). There is also nowhere to explain what a package actually includes.

## What to build

### 1. Fix the demo entry
Replace the "7011" extra on your Tour de Addo entry with two realistic lines: "E-Bike Rental" (size Medium) and "No Hassle Package" (bike transfer), so the section can be judged on real content.

### 2. Per-event package catalogue (admin-managed)
A new "Packages & extras" editor inside the existing event info admin, where each item has:
- match name (matches the Entry Ninja item name, case-insensitive, partial allowed)
- display name, short summary, category (Accommodation, Bike & rental, Transfers, Services, Merchandise)
- price, and a list of "what's included" bullet points plus optional notes (e.g. collection dates for the No Hassle Package)

Items on a rider's entry are matched against this catalogue; anything unmatched still shows with a tidied name.

### 3. Redesigned rider display
Rename the block to "Your packages & extras" and:
- group lines by category with a small icon per group
- each line becomes a tappable row that expands to show the summary, inclusions and notes from the catalogue
- clean up option values: show them as a size chip only when they look like a size, otherwise as a plain option chip, and hide filler answers like "Yes I want this"
- show price and a total only when prices exist (catalogue price used as fallback when Entry Ninja returns none)
- keep the "Add or edit on Entry Ninja" link, and show an empty state ("No extras booked — add accommodation, transfers or rentals on Entry Ninja") when a rider has none
- apply the same grouping and detail to the downloadable report

### 4. Accommodation cross-link
When a rider's extras include an accommodation item and rooming data exists for them, surface the tent/room number inline in that row so accommodation reads as one story.

## Technical notes

- New table `public.event_extra_items` (event_id, match_name, display_name, category, summary, price_cents, inclusions jsonb, notes, sort_order) with public read and admin write, following existing RLS/GRANT patterns.
- Extras normalisation stays in `src/lib/my-events.ts`; matching/formatting helpers go in a new `src/lib/extras.ts` shared by `src/routes/my-events.$eventId.tsx` and `src/routes/my-events_.$eventId_.report.tsx`.
- Admin editor added to `src/routes/admin.event-info.$eventId.tsx`.
- Entry Ninja sync is unchanged apart from continuing to store raw lines; the catalogue is the presentation layer, so re-syncs never wipe curated copy.
