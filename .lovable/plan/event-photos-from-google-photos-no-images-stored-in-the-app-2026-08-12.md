# Event photos from Google Photos (no images stored in the app)

## The short answer

Keep the photos where they are. Each event gets a Google Photos **shared album link** pasted into the admin panel. The app reads that album link on the server, gets back the list of photo URLs, and displays them in a grid. The pictures themselves stream straight from Google's servers — we only ever store the album link and a short-lived list of URLs, so there's no storage cost and no duplicate copies to manage.

When you add photos to the album in Google Photos, they show up in the app on the next refresh. Nothing to re-upload.

## What riders see

A new **Photos** tab on the event page (next to Info, Village, News, Chat, Ask):

- A tappable grid of thumbnails from that event's album
- Tap a photo to view it full-screen with swipe left/right
- A "Open full album in Google Photos" button at the bottom, for downloading originals
- If no album is linked yet: "Photos from this event will appear here soon."

## What you do as admin

In the event editor, one new field: **Google Photos album link**. Paste the "Share > Create link" URL from the album and save. Buttons to preview and to force a refresh if you've just added photos.

## Important caveats to know up front

- The album must be shared with "Anyone with the link". Private albums can't be read.
- Google doesn't offer an official way to list someone else's shared album, so the app reads the public album page. If Google changes that page's format, the grid can stop filling — in that case the tab automatically falls back to the "Open album in Google Photos" button, so riders always have a working path to the photos.
- Photo links from Google expire after a while, which is why the app refreshes the list rather than storing it permanently.

## Technical notes

- New column `events.photos_album_url` (text, nullable), edited in `admin.events.tsx` and carried through `src/lib/cloud.ts` + the `Event` type.
- New table `public.event_photos_cache`: `event_id` (PK, FK events), `photos jsonb` (array of `{ id, baseUrl, width, height }`), `refreshed_at`, `last_error`. Public read (`TO anon` SELECT), writes via service role only. Grants + RLS in the same migration.
- `src/lib/event-photos.server.ts`: fetches the shared album HTML server-side and extracts the `lh3.googleusercontent.com` base URLs plus dimensions from the embedded JSON payload; dedupes and caps at ~200 photos.
- `src/lib/event-photos.functions.ts`:
  - `getEventPhotos({ eventId })` — public server fn; returns cached rows, and re-crawls when `refreshed_at` is older than 6 hours or the cache is empty.
  - `refreshEventPhotos({ eventId })` — admin-gated (role check via `context.supabase`), forces a re-crawl; loads `supabaseAdmin` inside the handler.
- Thumbnails render with Google's sizing suffix (`=w400-h400-c`) for grid and `=w1600` for the lightbox, with `loading="lazy"` — cheap bandwidth, no proxying through our server.
- Photos tab component added to `src/routes/my-events.$eventId.tsx`, following the existing tab pattern; lightbox is a simple client-side overlay (no new dependency).
- Refresh piggybacks on the existing daily cron pattern used for the event bot knowledge crawl, so albums stay warm without a rider waiting on a crawl.
