# Track Riders + Results

Turn the Spectate section into a proper "Track Riders" hub: every event lists its riders with bib numbers, anyone can search them, and each rider links through to results.

## What riders and supporters get

**Track Riders (per event)**
- Full rider list pulled from the event's synced entrants, showing name, bib number, category and batch.
- Search by name or bib, filter by category/batch, sorted sensibly.
- Public — no sign-in needed, so supporters can share a link to a rider.
- Each rider row is tappable: opens that rider's result card (or the external results page with their bib, when we only have an outside link).

**Results section (per event)**
- A results page per event with imported result rows: position, bib, name, category, time, gaps, and any extra columns from the import.
- Filter by category/batch, search by name/bib, and switch between stages/days when the import has more than one.
- Compare mode: pick 2–4 riders and see their times side by side (per stage and overall).
- If results aren't imported yet, the page shows the event's external results link instead (single button), so day-one events still work.

**Admin: importing results**
- Upload a CSV (or paste rows) on the admin event screen.
- A column-mapping step: the importer previews the file, guesses which column is position/bib/name/time/category, and lets you correct it and save that mapping as a reusable "result format" for that event/provider.
- Re-importing replaces or appends a named result set (e.g. "Day 1", "GC"), so live updates during an event are one upload.
- Fields for an external results URL and an optional per-rider URL template (with a `{bib}` placeholder) used when a timing provider hosts the detail page.

**Version 2 (not built now)**
- Live timing feed instead of CSV: the same results tables get written by a sync job, so the rider-facing UI does not change.

## Current state this builds on

- `event_entrants` already stores `bib_number`, `category`, `batch`, `started_at`, `finished_at`. Bibs exist for some events (PE Plett 110 of 154, Sea to Sea 13 of 19) and are empty for others — the list handles blank bibs gracefully.
- The existing spectator roster only returns rows when the event's `spectator_mode` flag is on, and only for signed-in users. Both restrictions get removed for the rider list.
- `events` has no results fields yet, and there is no results table.

## Technical outline

Database migration:
- `events`: add `results_url text`, `results_rider_url_template text`, `results_published boolean default false`.
- `event_result_sets` — one row per import set (`event_id`, `label`, `kind` (stage/overall), `sort_order`, `imported_at`, `column_map jsonb`).
- `event_results` — one row per rider result (`result_set_id`, `event_id`, `bib_number`, `full_name`, `category`, `position int`, `time_text`, `time_ms bigint`, `gap_text`, `extras jsonb`, `event_entrant_id` nullable link).
- Grants: `SELECT` to `anon` and `authenticated`; full access to `service_role`. RLS on, public read policies (results and rider lists are public by design), writes admin-only via the existing `has_role` check.

Server functions:
- `getEventRoster` (public, publishable client) — name, bib, category, batch only; no emails, phones or IDs.
- `getEventResults` — sets + rows for an event.
- `importEventResults` (admin) — accepts parsed rows + column map, upserts a result set, links rows to `event_entrants` by bib.

Routes/components:
- Rework `src/routes/spectate.$eventId.tsx` into tabs: Info · Riders · Results (start/finish lists fold into Riders).
- New `src/components/rider-track-list.tsx` and `src/components/results-table.tsx` (with compare drawer).
- Admin results tab inside `src/routes/admin.events.tsx` (or a new `admin.results.$eventId.tsx`) with CSV upload, mapping UI and set management.
- Relabel the Spectate nav entry to "Track Riders" and keep the existing URL so shared links keep working.
