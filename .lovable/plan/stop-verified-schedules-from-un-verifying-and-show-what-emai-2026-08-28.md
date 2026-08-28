# Stop verified schedules from un-verifying, and show what emails are going out

## What went wrong with Hannes's mail

The nightly website scrape ran for Weekend Warrior Lourensford at 06:02 on 28 Aug. Every scrape run rewrites that event's sync record as "unverified / needs review" unless auto-apply is switched on — even when the scraped times are identical to the ones already live in the app. Rider emails are built to never quote unverified times, so the mailer replaced every time with "TBC". The dates and day structure were right; only the times were blanked.

So nothing changed on the website. The scrape simply reset a flag you had already cleared.

## Fix 1 — verification sticks until the website actually changes

- Immediate: mark the Lourensford 2026 schedule verified again, with the scraped times checked against weekend-warrior.co.za (reg Fri 13:30-17:30; Sat reg 09:30-11:30, Gold E-Bike 12:25 / Gold 12:30 / Silver 12:35 / Bronze 12:40; Sun reg 06:30, Gold E-Bike 07:55 / Gold 08:00 / Silver 08:05 / Bronze 08:10, prize giving 12:00).
- Ongoing: when a scrape finishes, compare the newly scraped times against the schedule currently live in the app. If they match, keep the event verified and leave "needs review" off. Only raise "needs review" when the website genuinely produces different times, drops times, or the scrape fails.
- When a change is detected, the sync record records what changed (added / removed / changed times) so review is a quick glance, not a re-check of the whole programme.
- Nothing auto-applies silently: a real change still waits for your approval, exactly as today.

## Fix 2 — one page showing what riders actually receive

New admin page, "Email content" (linked from the admin nav next to Schedule sync):

- One row per live event, showing: whether its schedule is verified, when it was last checked, and — most importantly — the exact key times the welcome/apology emails would print right now, day by day (Registration Day, Day 1, Day 2 ... with dates).
- A clear "TBC" badge on any event whose emails would currently go out without times, so a silent fallback is visible before riders get it, not after.
- A "Preview the mail" action per event that renders the real welcome email as a rider in that event would receive it (pick a category/trip where the event has several).
- A one-click "Times are correct" button per event to mark the schedule verified from that page.

## Technical notes

- `src/lib/schedule-scrape.server.ts`: replace the unconditional `verified: false, needs_review: true` write with a comparison against the event's current `schedule` array; keep the previous `verified`/`verified_at` when the scraped item set is equivalent (same date + time + normalised label set). Store a `review_note` diff summary when it is not.
- Data fix for `event_schedule_sync` on event `2dc4fd8c-...` (Lourensford 2026): set `verified = true`, `needs_review = false`, review note recording the source check. Applied via a data update, no schema change.
- No schema change is expected; `event_schedule_sync` already carries `verified`, `verified_at`, `needs_review`, `review_note`.
- New route `src/routes/admin.email-content.tsx` plus an admin server function that reuses `riderScheduleForEmail` and `scheduleTrustedEventIds` from `src/lib/entry-welcome.server.ts`, so the page shows exactly what the mailer would build — same code path, no second source of truth.
- Email preview reuses the existing test-send/preview machinery already used on the Entry Ninja admin page.
