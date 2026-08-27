# Make the Cycle Lab R150 offer clear everywhere

Today the Cycle Lab offer reads as "event only": the description says "Redeemable at the event only — claim R150 off in store at the Cycle Lab stand", and the redeem line says "Claim in store at the Cycle Lab stand with your cell number". That contradicts the real offer.

## The offer, stated once and reused

R150 to spend at Cycle Lab, loaded against the cell number on your entry. Redeem it at the event stand or in any Cycle Lab store — just give the cell number you entered with. No code needed.

## What changes

1. **The offer copy in the backend** (Admin → Supplier promos, Cycle Lab):
   - Title: "R150 to spend at Cycle Lab"
   - Description: "R150 is loaded onto the cell number on your entry. Spend it at the Cycle Lab stand at the event or in any Cycle Lab store."
   - How to redeem: "No code — give the cell number on your entry at the Cycle Lab stand or in any Cycle Lab store."
   - Discount badge stays "R150". Still fully editable/deletable in the admin console afterwards.

2. **The reminder pop-up** (the one that opens wherever an offer is tapped): for offers without a code, the redeem instruction is currently a single small grey line. Give it the same weight the code gets — a bordered panel with a "How to redeem" label — so the phone-number instruction is unmissable. This applies to every code-less offer (Cycle Lab, Rudy Project, Westvaal), not just Cycle Lab.

3. **Show the rider their own number.** When a signed-in rider opens a code-less offer and we have the cell number from their entry, display it under the redeem instruction ("Your entry number: 082 xxx xxxx") with a copy button, so they can read it straight off the screen at the till. Falls back silently to the plain instruction when we don't have a number.

Because every surface (home page, event info pages, route sections, the promos page, spectator pages) renders the same offer record and opens the same pop-up, these three changes cover all the places Cycle Lab appears — no per-page copy edits.

## Technical notes

- Copy change is a data update to the Cycle Lab row in `public.promos` (title, blurb, redeem).
- `src/components/promo-reminder-dialog.tsx`: restyle the no-code branch into a labelled panel; add the rider's entry phone number, read from the existing entrant record for the signed-in user, with a copy action.
- Project memory rule "Cycle Lab promo = R150 in store at the event, linked to cell number" gets corrected to include in-store redemption anywhere.
- No changes to promo matching, admin CRUD, or the offer cards themselves.
