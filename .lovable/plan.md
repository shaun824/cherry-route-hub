# Bring back the Green Motion promo

## Why it disappeared
The Green Motion "15% off your vehicle rental" offer is still in the database and switched on, but its expiry date was 31 August 2026. The app hides any promo whose expiry date has passed, so it vanished from all pages on 1 September. Nothing was deleted and no code is broken.

## Fix (data only, no code changes)
- Clear the expiry date on the Green Motion promo so it stays visible until you switch it off manually in Admin → Promos.
- Verified: the other promos (Rudy Project, Westvaal, Cycle Lab) are active and unaffected; Cycle Lab still expires 15 Sep 2026 as intended.

## Verification
- Query the promos table to confirm the expiry is cleared.
- The promo reappears automatically everywhere it applies (Weekend Warrior, Tour de Addo, Sea to Sea, Plett) on next app load.

## Technical details
- Single UPDATE on `public.promos` (id `9057df00-f750-48cf-8380-c32efb71d626`) setting `expires = null`.
- Display filtering lives in `isPromoLive` (`src/lib/event-promos.ts`); with no expiry the promo is always live while `active = true`.
