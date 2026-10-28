# Roadmap

## Native sign-in and self-account deletion
- [ ] Hide Google and divider only on native /auth, retain email sign-in/sign-up
- [ ] Authenticated deletion and race-record retention with sensitive-data cleanup
- [ ] Profile danger action, DELETE confirmation and privacy policy
- [ ] Tests and signed-in verification

## ICE 2026 event-interest sign-ups + race-week campaign (Shaun, 28 Oct)
- [x] Migration: event_interest_signups table, campaign audience column, step send_at/theme, events.everlytic_interest_list_id
- [x] POST /api/public/event-interest (X-Event-Interest-Key secret, honeypot, rate limit, upsert, optional Everlytic sync, no emails)
- [x] Unsubscribe endpoint + unsubscribe link in interest emails
- [x] Workflow audiences: entrants / interest / both, deduped; send_at scheduling; hourly hook unchanged
- [x] Admin: audience selector, interest sign-ups list with count + CSV export
- [x] ICE-styled event-update brand (black/red/navy, condensed uppercase)
- [x] Draft ICE 2026 race week campaign (24 Nov 2026 09:00 SAST, status draft, never sends until Shaun switches on)
- [x] Tests + build check
- [ ] Publish

## Open / waiting
- Shaun to add EVENT_INTEREST_KEY secret, then wire the WordPress contact form to POST /api/public/event-interest
- Shaun to confirm ICE parking/gate details and switch the campaign on himself
- Optional: set an Everlytic interest list ID on the ICE event for auto list sync
- BaseCamp import of GPS pack unverified; single-route app downloads still have old internal names (awaiting Shaun)
- Everlytic campaign 923637 armed for 1 Dec 2026 09:00 SAST — never resend; replace only
- Michelle Bester password reset pending her retry
