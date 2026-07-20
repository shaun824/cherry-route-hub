Problem: the roster CSV importer requires `event_id` to be a raw UUID (`z.string().uuid()`). Users naturally upload spreadsheets where the event column contains human-readable event names, causing the "Invalid uuid" validation
validation error.

Goal: let admins upload a CSV with either an event UUID or an event name, and map names to the correct event automatically. If a name can't be matched, show a clear row-level error before import.

Changes:

1. **Loosen the server schema**
   - In `src/lib/roster.functions.ts`, change `event_id` from `z.string().uuid()` to `z.string().trim().min(1)`.
   - Before inserting into `event_entrants`, look up events by UUID first; if that fails, try a case-insensitive match on `events.name`.
   - If neither matches, record a row error like "Row 3: 'Spring Classic' did not match any event".

2. **Pre-load event name map in the handler**
   - Fetch `id, name` from `public.events` once at the start of `importRoster`.
   - Build a case-insensitive lookup map so name matching is fast and deterministic.

3. **Improve the admin UI validation**
   - In `src/routes/admin.roster.tsx`, after parsing the CSV, run a client-side check that tries to resolve each `event_id` against the list of events already loaded in `eventsQ`.
   - Show a row-level warning when a value looks like a name rather than a UUID, and confirm which event it will be mapped to.
   - Keep the "Default event" dropdown working as a fallback for blank `event_id` cells.

4. **Update the sample CSV and help text**
   - Change the sample value from `<event-uuid>` to a real-looking event name, e.g. `My Event Name`.
   - Update the helper copy to say: "event_id can be the event's UUID or the exact event name as shown in Admin → Events."

5. **Preserve existing behaviour**
   - Existing valid UUIDs continue to work unchanged.
   - The default-event dropdown still fills blank cells.
   - Admin-only access and ID hashing remain unchanged.

Acceptance:
- Uploading a CSV with `event_id` = an event name imports successfully and links the rider to the correct event.
- Uploading a CSV with a misspelled event name shows a clear "did not match any event" error for that row.
- The existing sample download still imports correctly after the sample is updated.