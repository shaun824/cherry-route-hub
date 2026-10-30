# Rider data security (30 Oct)
- [x] Fix exposed scheduled tasks and preserve authorized schedules
- [x] Protect GPS, SOS, private rider records and shared crew access
- [x] Fix account, export, training, click tracking and actionable findings
- [x] Verify denied public hooks, signed-in crew/race control, 72 tests and quick rescan
- [ ] Confirm sharing on a real device, browser clipboard readback was unavailable
- [ ] Publish security fixes
- [x] Review deep scan of the pre-change snapshot and address new findings

# Roadmap

## ICE venue correction (30 Oct)
- [x] Replace rider venue and parking directions with Shaun's fixed pin
- [x] Keep Sun International as pro accommodation only; verify venue stays fixed
- [x] Check app links signed in as Shaun and venue tests
- [ ] Publish venue corrections

## Apple and Google rider sign-up (30 Oct)
- [x] Enable both managed providers and show both on web and native auth
- [x] Preserve rider profiles, entry linking and email sign-in
- [x] Add Apple disconnect after account deletion
- [x] Verify sign-in, recovery and Apple disconnect screens; eight regression tests passed
- [ ] Verify provider consent on a real native device, requires TestFlight device

## ICE website near-top sign-up (30 Oct)
- [x] Add first-name/email opt-in to supplied WordPress page, preserving the design
- [x] Secure public opt-in flow, store consent and sync Motorbikes list without exposing the shared key
- [x] Verify immediate confirmation and race-week audience/schedule in Everlytic (924873, list 146523), old Hub campaign paused
- [x] Test form and deliver updated website code
- [ ] Install supplied HTML on WordPress, requires Shaun's website editor

## Native sign-in and self-account deletion
- [x] Native email sign-in/sign-up retained; Apple and Google now offered too
- [x] Authenticated deletion and race-record retention with sensitive-data cleanup
- [x] Profile danger action, DELETE confirmation and privacy policy
- [x] Tests and signed-in verification with disposable accounts; entries/results retained, personal GPS/SOS/favourites removed

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
- [x] EVENT_INTEREST_KEY configured and live sign-up verified
- [x] ICE parking confirmed and race-week campaign scheduled in Everlytic for 24 Nov at 09:00 SAST
- [x] ICE sign-ups sync to Motorbikes and dedicated ICE race-week list
- BaseCamp import of GPS pack unverified; single-route app downloads still have old internal names (awaiting Shaun)
- Everlytic campaign 923637 armed for 1 Dec 2026 09:00 SAST — never resend; replace only
- Michelle Bester password reset pending her retry
