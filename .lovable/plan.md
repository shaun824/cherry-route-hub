# Display Entry Ninja merchandise cleanly (no prices)

## What's already working

Merchandise and extras are being pulled from Entry Ninja for every event that has them:

- PE PLETT 2027 — Bike Wash, CSA temp license, vehicle transfer service, 3-day bike service, chalet/hotel accommodation options, No Hassles Package, apparel sizes, dietary requests (153 of 154 entrants)
- Tour de Addo — E-Bike Rental (with size)
- Weekend Warrior Lourensford — luxury tents, RCE tent rental, camping options
- Sea to Sea North, Ride For Change — extras present
- Forest Boogie, Inner City Enduro, Rallye Raid — no extras, but these have only 1–6 entrants each, so there is likely nothing to pull yet

## The actual gap

Prices are not needed — riders already paid for these on Entry Ninja. The gap is presentation: the stored lines mix real merchandise (Bike Wash, E-Bike Rental, tent rentals) with apparel sizes, accommodation choices and admin questions (CSA temp license, dietary requests, "What hotel would you prefer?"), and long option strings like "Yes I want a bike wash" read poorly on the card.

## Plan

1. Remove price and total display from the entry card and the downloadable report; show item, option and quantity only.
2. Group the extras into clear sections on the entry card: Merchandise & add-ons, Accommodation, Apparel, and Other details (licences, dietary requests).
3. Tidy the option text — drop "Yes I want..." style prefixes so a line reads "Bike Wash — Included" rather than repeating the question, and keep sizes as-is.
4. Keep the "Add or edit on Entry Ninja" button so riders change anything at source.
5. Confirm the tidied layout on PE PLETT, Tour de Addo and Weekend Warrior entries at mobile and desktop widths.

## Technical notes

- Display: `src/routes/my-events.$eventId.tsx` entry card and `src/routes/my-events_.$eventId_.report.tsx`.
- Data stays as-is in `event_entrants.extras` JSONB (`{ name, qty, size }`); no sync or schema change needed.
- Note: a few older rows store `extras` as an object rather than an array — handle both shapes when rendering.
