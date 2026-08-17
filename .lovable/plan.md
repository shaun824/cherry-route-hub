# Automatic "You're entered" welcome email for Entry Ninja entries

Every rider that comes across from Entry Ninja gets one personalised email per event: it confirms the event they've entered, creates their app account if they don't have one, gives them a "Set your password" button, and walks them through everything the app does.

## What the rider receives

Subject: "You're in — <Event name>" (Red Cherry branded, event logo where available)

Body:
- Greeting by first name, event name, date, venue, their category/bib if known.
- Big "Set your password & open the app" button (invite link) — or "Open the app" if they already have an account.
- Feature walkthrough with short icon-led blurbs: routes with elevation profiles and water points, live schedule per day, village map with your accommodation pinned, your entry inclusions and merchandise, weather, event chat/ask-the-bot, Cherry Miles loyalty, SOS/tracking, news feed and promos.
- Footer with event website + WhatsApp help. Unsubscribe is added automatically by the platform.

## When it sends

- **Automatic:** during the Entry Ninja sync, whenever an entry is newly linked for a rider+event pair for the first time and the rider has an email address. Riders imported without an email are skipped (they claim by ID later).
- **Never twice:** a send is recorded per entry; re-syncs, updates and repeated cron runs don't resend.
- **Manual backfill:** a new admin panel lets you pick an event, see how many entrants have never been emailed, and send in controlled batches (e.g. 50 at a time) with a live count of sent / skipped / suppressed.
- Sends are paced so we stay inside the hourly email allowance; suppressed (bounced/unsubscribed) recipients are skipped silently.

## Safety

- Only entrants of events you have already linked in the app.
- Only one email per rider per event, ever.
- Backfill is opt-in per event, never automatic for historic entries.

## Technical notes

- New template `src/lib/email-templates/entry-welcome.tsx` registered in `registry.ts`; sent via the existing `sendTemplateEmail` helper with an idempotency key of `entry-welcome-<eventEntrantId>`.
- Migration: add `welcome_email_sent_at timestamptz` to `public.event_entrants` (nullable), no grant changes needed beyond existing table grants.
- `src/lib/entryninja-sync.server.ts`: after a successful `event_entrants` upsert, collect newly-created links into a queue; a new `src/lib/entry-welcome.server.ts` handles account provisioning (Supabase admin `inviteUserByEmail` / generate recovery link when the user exists), template send, and stamping `welcome_email_sent_at`.
- Sending happens after the per-event loop, capped per run (default 100) so the cron hook stays inside its time budget; leftovers are picked up on the next run.
- Admin UI: new "Welcome emails" card in the existing Entry Ninja / rider admin area calling a new authenticated server fn `sendEntryWelcomeBatch` (admin role checked), returning sent/skipped counts.
- Reuses the existing branded auth-invite wiring so the password link lands on the app's set-password screen.
