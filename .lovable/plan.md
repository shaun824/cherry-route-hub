# Get prices onto Entry Ninja merchandise lines

## What's already working

Merchandise and extras are being pulled from Entry Ninja for every event that has them:

- PE PLETT 2027 — Bike Wash, CSA temp license, vehicle transfer service, 3-day bike service, chalet/hotel accommodation options, No Hassles Package, apparel sizes, dietary requests (153 of 154 entrants)
- Tour de Addo — E-Bike Rental (with size)
- Weekend Warrior Lourensford — luxury tents, RCE tent rental, camping options
- Sea to Sea North, Ride For Change — extras present
- Forest Boogie, Inner City Enduro, Rallye Raid — no extras, but these have only 1–6 entrants each, so there is likely nothing to pull yet

## The actual gap

Not one stored extras line has a price. Across all events, zero lines have a price value, so riders see "Bike Wash — Yes I want a bike wash" with no amount, and the extras total on the entry card and report always reads blank.

The sync code already looks for several possible price keys, but none of them are matching what Entry Ninja actually returns. That is unconfirmed as the root cause — it could equally be that the entries endpoint omits pricing entirely and it lives on a separate products/registration endpoint.

## Plan

1. Capture the raw Entry Ninja payload for one PE PLETT entry that has a bike wash, and log the exact shape of the merchandise/extra objects. This confirms whether a price is present and under what key, or absent from that endpoint.
2. If a price key exists: extend the price extraction in the sync to read it (including nested item/option price objects and string amounts like "R350.00"), then re-sync all events to backfill.
3. If the entries endpoint has no pricing: check the Entry Ninja products/event-options endpoint for a per-event price list, store it as a per-event lookup keyed by item + option name, and resolve prices at display time.
4. If Entry Ninja exposes no pricing at all through the API: add a small admin screen where prices can be set per event per merchandise item, used as the fallback for display and totals.

Whichever path applies, the entry card and the downloadable report then show line prices and a correct extras total.

## Technical notes

- Sync entry points: `src/lib/entryninja.server.ts` (API client, `toLineArray`, price key resolution) and `src/lib/entryninja-sync.server.ts` (builds the `extras` JSONB array of `{ name, qty, size, price }`).
- Display: `src/routes/my-events.$eventId.tsx` entry card and `src/routes/my-events_.$eventId_.report.tsx`.
- Storage: `event_entrants.extras` JSONB — no schema change needed for steps 1–3; step 4 would add a per-event price table.
- Note: a few older rows store `extras` as an object rather than an array; normalise those during any backfill.
