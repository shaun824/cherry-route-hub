# Night-by-night accommodation for moving events

Events like PE PLETT move venue each night (St Francis Links, Fynbos Ridge, Tsitsikamma Lodge and Spa). Today the app only stores one accommodation allocation per rider per event, so a rider sees a single tent/room with no idea which night it applies to.

## What riders will see

**On the event home tab — "Where you sleep" card**
A compact timeline, one row per night:

```text
Night 1 · Wed 17 Feb   St Francis Links      Tent T12      [Map] [Village]
Night 2 · Thu 18 Feb   Fynbos Ridge          Chalet 4      [Map] [Village]
Night 3 · Fri 19 Feb   Tsitsikamma Lodge     Tent B7       [Map] [Village]
```

- Tonight's night is highlighted so riders instantly see where they're headed.
- Each row shows the venue, their own tent/room number and room type, plus notes (check-in time, bedding, luggage).
- "Village" jumps straight to that venue's village map, focused on their tent pin (reuses the existing focus behaviour).
- "Map" opens directions to the venue.
- Rows with no allocation yet read "Allocation coming soon" rather than looking broken.
- Single-venue events are unaffected: the card falls back to today's single allocation card as it does now.

**New Accommodation tab**
Same night-by-night breakdown, expanded: venue address, mini map per venue, check-in/out times, venue notes, what's included (bedding etc.), luggage/transfer notes, and the full "show me on the village map" link. Added to the event section nav so the home card can link into it.

## Admin side

- Each venue gets which nights it covers (start night + number of nights, or explicit nights picked from the event days).
- Rooming lists stay per venue, so an admin uploads or syncs one Google Sheet per venue exactly as today — the night comes from the venue.
- Where a rider changes tent within the same venue across nights, an optional night column on a rooming row overrides the venue default.
- Admin rooming page gains a per-night view so you can check every rider has a bed for every night, and a warning listing riders missing an allocation for a given night.

## Event bot

The rider assistant answers "where do I sleep on night 2?" and "what tent am I in tomorrow?" using the same per-night data, including venue address and check-in notes.

## Technical notes

- `event_venues`: add `night_start` (1-based index into the event days) and `nights` (count), plus optional `check_in`, `check_out`.
- `event_rooming`: add nullable `night_index`; null means "applies to every night this venue covers".
- `src/lib/rooming.ts`: replace `fetchMyRooming` (single row) with `fetchMyNights(eventId)` returning one entry per event night — day label/date, venue, allocation row, village focus ids. Keep a thin single-row helper for the existing entry card.
- New `src/components/accommodation-timeline.tsx` used by both the home card and the new tab; night labels come from `withRegistrationDayLabels` so numbering matches the rest of the app.
- New route `src/routes/my-events.$eventId.accommodation.tsx` (or a tab within the existing event page, matching how Village/Routes tabs already work) with its own head metadata.
- Admin: extend `src/routes/admin.rooming.tsx` with venue night fields and the per-night coverage check.
- `src/lib/event-bot-rider.server.ts`: include the per-night allocation list in the rider context.
