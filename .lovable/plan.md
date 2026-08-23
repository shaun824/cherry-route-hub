# Real Instagram photos and reels in the app

Today the social wall only shows post links we found on event websites, rendered through Instagram's own embed script — slow, sometimes blank, and never automatically up to date. This replaces it with the official Instagram Graph API so the app holds the actual images, videos and captions and plays them itself.

## What riders will see

- A swipeable media scroller on the home page and at the bottom of each event page.
- Reels and videos autoplay muted and loop as you scroll; tap to unmute, tap the caption to open the post in Instagram.
- Photos and carousels show full-bleed with the caption, date and the account handle.
- Everything loads from our own cache, so it works fast on event Wi-Fi and doesn't depend on Instagram's embed script.

## What you'll need to do once

Your Meta Business account (the one already behind WhatsApp) needs to be linked to each Instagram account we pull:

1. Instagram account set to Professional (Business or Creator) and linked to a Facebook Page.
2. Grant the app the `instagram_basic` / `pages_show_list` permissions and hand over a long-lived token — I'll ask for it as a secret when we build.
3. Accounts you do not own (partner/venue pages) can still be pulled read-only via business discovery as long as they are professional accounts; anything else stays a manual "add a post link" entry.

## Admin controls

The existing Social feeds admin page gets:
- An Instagram account field per event (handle or account ID) instead of just a profile URL.
- "Pull latest posts" per event, plus an automatic refresh every few hours.
- A list of pulled posts with thumbnails, and a hide toggle so you can drop anything off the wall.
- Manual post links keep working alongside the pulled ones.

## Technical notes

- Secret `INSTAGRAM_ACCESS_TOKEN` (long-lived Meta token) plus an optional `INSTAGRAM_BUSINESS_ID`, read only inside server function handlers.
- New server module `src/lib/instagram.server.ts`: fetch `/{ig-user-id}/media` with fields `id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_url,media_type}`, and `business_discovery` for other handles.
- Extend `event_social_posts` with `media_type`, `media_url`, `thumbnail_url`, `posted_at`, `cached_path`, `hidden`; keep `source` so website-scraped and manual rows survive. Migration includes GRANTs and public read policy for active rows.
- Instagram CDN URLs expire, so each refresh downloads media into a public Supabase Storage bucket (`social-media`) and stores that path; the app never links to the expiring CDN URL.
- Refresh path: `runSocialSync` server fn (admin-gated) for the manual button plus a `/api/public/hooks/social-sync` cron endpoint with a shared-secret header, scheduled a few times a day.
- `src/components/social-wall.tsx` rewritten to render our cached media directly — `<video muted playsInline loop autoPlay preload="metadata">` for reels driven by an IntersectionObserver (only the in-view card plays), `<img loading="lazy">` for photos. Instagram's `embed.js` is dropped.
- Website scraping stays as the fallback for events without a linked professional account.
