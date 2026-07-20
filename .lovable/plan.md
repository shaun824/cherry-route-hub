
## Pivot summary

The app stops trying to sell entries. Entry Ninja remains the source of truth for who's entered. Riders sign in, prove they're on the roster (email + ID number), and land on a personalised dashboard of the events they're already entered in — with all the "how do I find the venue / when does it start / what do I pack" info in one place. Each event also gets a group chat and a private admin Q&A thread.

## What gets hidden (not deleted)

- `/events/$eventId/enter` route + button — hidden behind a feature flag (`entriesEnabled: false` in `site_settings`) so it can be flipped back on later.
- Home page "RSVP" button on the upcoming events carousel → replaced with "View info" (or hidden if the rider isn't entered).
- Admin → Events keeps working; just no public entry CTA.

Nothing about the checkout/payment code is removed — it just stops being reachable from the rider UI.

## New data model

New tables (all with GRANTs + RLS):

- `entrants` — one row per uploaded person. Fields: `full_name`, `email` (lower-cased, indexed), `id_number_hash` (SHA-256, never store raw), `id_number_last4` (for UI hints), `phone`, `notes`. Optional `user_id` once they've linked their auth account.
- `event_entrants` — join table `(event_id, entrant_id)` with per-event fields: `category`, `batch`, `bib_number?`, `external_id` (Entry Ninja ID stub).
- `event_info_blocks` — structured per-event content the admin edits: `venue_address`, `venue_lat/lng`, `map_embed_url`, `parking_notes`, `packing_list` (jsonb array of `{item, essential}`), `route_description`, `distance_km`, `elevation_m`, `gpx_url`, `rules_md`, `waivers_md`, `faqs` (jsonb), `emergency_contacts` (jsonb array of `{label, phone}`). One row per event.
- `event_chat_messages` — `event_id`, `author_id`, `body`, `created_at`. Realtime enabled. RLS: only entrants of that event (or admins) can read/post.
- `admin_qa_threads` — `event_id`, `entrant_user_id`. One thread per rider per event.
- `admin_qa_messages` — `thread_id`, `author_id`, `body`, `is_admin`, `created_at`. RLS: thread owner + admins only.
- `packing_checklist_state` — `user_id`, `event_id`, `item_key`, `checked`. Lets riders tick items off privately.

## Rider access flow

1. Rider hits `/auth`, signs in with Google or magic link (existing auth stays).
2. First time in, a "Link your entry" screen asks for **email** (prefilled from auth) + **ID number**. Server function hashes the ID and looks for a matching `entrants` row.
3. On match → sets `entrants.user_id = auth.uid()` and redirects to `/my-events`. On no match → friendly "we can't find you on the roster, contact the organiser" screen.
4. Once linked, `/my-events` lists every event they're entered in; the old public `/events` list can stay for browsing but is no longer the primary surface.

## Rider event page (`/my-events/$eventId`)

Full "standard blocks" package, tabbed or sectioned on mobile:

- **Header**: event cover + logo, name, date/time, countdown, their category + batch + bib.
- **Venue**: address, embedded map, GPS pin, parking notes, directions button (opens Google/Apple Maps).
- **Schedule**: existing schedule list, highlighted "next up" item on race day.
- **Packing list**: interactive checklist, persisted per rider.
- **Route**: distance, elevation, description, GPX download.
- **Rules & waivers**: markdown-rendered.
- **FAQs**: accordion.
- **Emergency contacts**: tap-to-call race control / medical.
- **Chat** and **Ask the organiser** tabs (see below).

## Admin: roster CSV upload

New page `/admin/roster`:

- File input accepts CSV with headers: `full_name,email,id_number,phone,event_id,category,batch`.
- Parsed client-side, validated with Zod, previewed in a table before commit.
- "Import" calls a server function that upserts `entrants` (by email) and inserts `event_entrants` rows. ID numbers are hashed server-side before insert; the raw value never touches the DB.
- Shows import summary: X new entrants, Y linked to existing, Z errors.
- Per-event roster view with search + remove-row.

## Admin: event info editor

Extend `/admin/events` edit modal with a new "Rider info" tab that edits the `event_info_blocks` row — venue address/map, packing list editor (add/remove/reorder items, flag essentials), route fields, rules/waivers markdown, FAQ editor, emergency contacts editor.

## Group messaging

Two surfaces per event, both realtime via Supabase Realtime on the message tables:

- **Event chat** (`/my-events/$eventId/chat`): open to all linked entrants of that event + admins. Standard chronological feed, rider avatars/names, admin badge, admins can delete any message, riders can delete their own. Simple text only for v1 (no images).
- **Ask the organiser** (`/my-events/$eventId/ask`): private thread between the rider and the admin team. Admins get an inbox view at `/admin/inbox` grouped by event, unread count badges.

RLS: chat readable/writable only if `has_role('admin')` OR the caller has a matching `event_entrants` row linked to their `user_id`. Admin Q&A readable only by thread owner or admins.

## Feature flag / rollback

`site_settings.entriesEnabled` boolean, default `false`. When `true`, the old public entry CTA + `/events/$eventId/enter` route become reachable again. No code deletion, just conditional rendering + a route guard that redirects to the event info page when the flag is off.

## Technical notes

- ID number handling: hash with `crypto.subtle` in the browser before sending? No — send over HTTPS, hash server-side in a server function using Node `crypto` and salt with a project-wide secret (`ID_HASH_SALT`, generated). Never persist raw ID numbers.
- All new tables get `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role;` then RLS with policies using `has_role(auth.uid(), 'admin')` and entrant-linkage checks.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE event_chat_messages, admin_qa_messages;` and subscribe inside `useEffect` per the realtime rules.
- CSV parsing with `papaparse` client-side, then a `createServerFn` for the bulk insert (chunked if the file is large).
- Existing `entered` boolean on `events` can stay for backwards-compat; the real source of truth becomes `event_entrants`.

## Build order

1. Feature flag + hide entry CTA + redirect entry route.
2. Schema migration (entrants, event_entrants, event_info_blocks, chat/Q&A tables, RLS, GRANTs, realtime).
3. Admin roster CSV upload + per-event roster view.
4. Rider "link my entry" flow + `/my-events` list.
5. Rider event page with all info blocks (venue, schedule, packing checklist, route, rules, FAQs, contacts).
6. Admin event info editor tab.
7. Event chat.
8. Admin Q&A + admin inbox.

Each step ships independently and doesn't break what's already there.
