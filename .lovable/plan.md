# Push notifications for Rider Hub

Yes — the app can send push notifications to riders' phones. Right now the app has no home-screen install support and no notification system, so this builds it from scratch, plus a WhatsApp broadcast option alongside it.

## How it will work for riders

1. Rider opens the Rider Hub and taps "Add to Home Screen" (a prompt card guides them). This is required on iPhone — Apple only allows notifications for apps added to the home screen.
2. First time they open an event they entered, a friendly card asks: "Get race-day alerts?" One tap enables it.
3. From then on they get notifications on their lock screen, exactly like a native app. Tapping one opens the right page in the app.
4. In Profile they can choose what they want: news, event reminders, urgent safety alerts (safety alerts stay on by default).

## What you get in the admin panel

A new **Notifications** section:

- **Compose and send** — title, message, optional link to a page in the app, optional image.
- **Audience picker** — everyone / entrants of one event / a specific batch or class within an event.
- **Urgent safety alert** toggle — bypasses rider preferences and quiet hours, marked in red on their phone.
- **WhatsApp broadcast** — same compose box, tick "also send on WhatsApp" to reach riders who gave a phone number via Entry Ninja. Uses your WhatsApp Business number.
- **Send history** — who it went to, how many devices received it, how many opened it.
- **Test send** — send only to yourself first.

## Automatic notifications

- **New feed post or warning** — when you publish a pinned post or a warning in the feed, a push goes out automatically (with an "also notify riders" checkbox so you can publish quietly).
- **Event reminders** — 7 days before and 1 day before an event, entrants automatically get a reminder with a link to their entry card (kit list, tent number, batch, extras).

## What to know before we build

- **Android and desktop**: works immediately, nothing extra needed.
- **iPhone**: only works once the rider adds the app to the home screen (iOS 16.4+). The app will nudge them to do this — expect maybe half of iPhone riders to complete it.
- **WhatsApp broadcast**: to send outbound WhatsApp messages Meta requires pre-approved message templates and charges per message. It also needs the four Meta Cloud API credentials. The push side works without any of that, so the build ships push first and WhatsApp behind a switch you flip once Meta approves your templates.
- **Best practice**: keep push for time-sensitive things (schedule changes, weather, start-time moves, results up, photos up). Use the news feed for everything else — riders switch off apps that over-notify.

## Recommended combination

Push for speed and free reach, WhatsApp for the critical race-eve/race-morning message that must be read, and the in-app feed as the permanent record every notification links back to.

## Technical section

- **PWA / installability**: add `public/manifest.webmanifest` (Red Cherry branding, standalone display, maskable icons), head tags in `src/routes/__root.tsx`, and an install-prompt component. No offline caching — a service worker is added only because Web Push requires one, registered from a guarded wrapper that refuses to register in the Lovable preview/iframe/dev and supports a `?sw=off` kill switch.
- **Service worker**: hand-authored `public/push-sw.js` limited to `push` and `notificationclick` handlers (a messaging worker, not an app-shell cache), so it stays outside the offline-PWA rules.
- **Web Push**: VAPID key pair generated once and stored as `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` secrets; public key exposed via a server fn. Sending uses a Workers-compatible pure-JS web-push implementation (Web Crypto based) — not the Node `web-push` package, which does not run in the edge runtime.
- **Database** (one migration, with GRANTs + RLS):
  - `push_subscriptions` — user_id, endpoint (unique), p256dh, auth, user_agent, last_seen_at, failure_count. RLS: owner insert/select/delete; service_role all.
  - `notification_preferences` — user_id, news, event_reminders, safety (safety forced true). Owner read/write.
  - `notifications` — id, title, body, url, image_url, audience (`all` | `event` | `batch`), event_id, batch/class filter, urgent flag, created_by, sent_at, counts.
  - `notification_deliveries` — notification_id, user_id, subscription_id, status, error, clicked_at (for open-rate stats and pruning dead endpoints).
- **Targeting**: audience resolves through `event_entrants` (event) and the batch/class column on entries (batch), joined to `profiles` → `push_subscriptions`. Riders with no linked account are skipped for push and picked up by the WhatsApp/email path.
- **Sending**: `src/lib/push.server.ts` (encryption + VAPID JWT) and `src/lib/notifications.functions.ts` (admin-guarded `has_role` check, compose/send/test/history). Fan-out batched with concurrency limits; 404/410 responses delete the subscription row.
- **Cron**: a `/api/public/hooks/notification-cron` route triggered by `pg_cron` hourly handles the 7-day and 1-day event reminders, idempotent via a `reminder_sent` marker per entrant+milestone.
- **Feed hook**: `admin.feed.tsx` gains a "notify riders" checkbox that calls the send fn after publish.
- **WhatsApp**: reuses the existing `src/lib/whatsapp.server.ts` Cloud API helpers; broadcast sends a pre-approved template per recipient, rate-limited, recorded in `notification_deliveries` with channel `whatsapp`. Dormant until the Meta secrets are present.
- **Admin UI**: `src/routes/admin.notifications.tsx` + sidebar entry in `admin.tsx`. Rider preference UI added to the profile route; permission prompt component shown contextually, never on first load.
