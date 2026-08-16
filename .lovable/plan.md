# Fix the repeated Tour de Addo card and standardise home page headings

## What's happening now

There is only one Tour de Addo 2026 in the database, so this is not duplicate data — the home page renders the same event in two (sometimes three) places:

1. "Your next event" hero at the top (your linked entry).
2. The "Coming up / You're entered" spotlight card just below it — which picks the same event when you have an entry.
3. The "Bicycle events" list further down, which lists every published upcoming event, including the one already shown above.

Headings are also inconsistent: section titles are small grey uppercase text, while other blocks (spotlight, notices, promos) have no matching heading at all.

## The fix

**Stop the repeat**
- The spotlight card only shows an event that is not already the "Your next event" hero. For a signed-in rider whose next event is already in the hero, the spotlight either shows the next event they have *not* entered (real discovery value) or is hidden entirely.
- The sport lists exclude any event already shown above them (hero event and spotlight event), so each event appears once per screen.
- Signed-out visitors are unchanged: no hero, so the spotlight stays as the lead card.

**Consistent headings**
- One shared heading style used above every section on the home page: black (`text-ink`), display font, sentence case, same size and spacing, with the optional "See all →" link on the right in cherry.
- Applied to: Motorbike events, Bicycle events, Supplier promos, and new headings where a section currently has none (the spotlight block gets "Next up", quick links get "Quick links").
- Sport sections keep their small round sport icon and collapse behaviour; only the type colour/size changes.

## Technical notes

- `src/components/ui-bits.tsx` — `SectionTitle` becomes the single heading primitive: `font-display text-base font-bold tracking-tight text-ink`, drops `uppercase` and `text-ink-soft`; add an optional `icon` prop so the sport sections can use it instead of their own inline `h2`. Also used by `src/routes/my-events.$eventId.tsx`, which will pick up the same darker style (intended).
- `src/routes/index.tsx` — compute `hiddenIds` (hero event id + spotlight id) and pass through to the `motoEvents` / `mtbEvents` filters; change `spotlightSource` so it skips `myNext` when the hero is rendering it. `SportSection` renders `SectionTitle` for both the collapsed button and static heading variants.
- No database or server changes; presentation only.
