# Roadmap

## ICE 2026 event-interest sign-ups + race-week campaign (Shaun, 28 Oct)
- [ ] Migration: event_interest_signups table, campaign audience column, step send_at, events.everlytic_interest_list_id
- [ ] POST /api/public/event-interest (X-Event-Interest-Key secret, honeypot, rate limit, upsert, optional Everlytic sync, no emails)
- [ ] Unsubscribe endpoint + unsubscribe link in interest emails
- [ ] Workflow audiences: entrants / interest / both, deduped; send_at scheduling; hourly hook unchanged
- [ ] Admin: audience selector, interest sign-ups list with count + CSV export
- [ ] ICE-styled event-update brand (black/red/navy, condensed uppercase)
- [ ] Draft ICE 2026 race week campaign (24 Nov 2026 09:00 SAST, status draft, never sends until Shaun switches on)
- [ ] Tests + build check + publish

## Open / waiting
- BaseCamp import of GPS pack unverified; single-route app downloads still have old internal names (awaiting Shaun)
- Everlytic campaign 923637 armed for 1 Dec 2026 09:00 SAST — never resend; replace only
- Michelle Bester password reset pending her retry
