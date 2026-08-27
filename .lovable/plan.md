# Add rider offers to the "You're in!" entry email

Every entry confirmation email will end with a clear list of the rider offers running on that event, including exactly how each one is claimed. You'll also get a "Send me a test" button so you can see the finished mail in your own inbox.

## What the rider sees

A new block at the bottom of the email, just above the sign-off:

```text
YOUR RIDER OFFERS
Cycle Lab — R150 to spend at Cycle Lab
  R150 is loaded onto the cell number on your entry.
  How to claim: No code — give the cell number on your entry at
  the Cycle Lab stand or in any Cycle Lab store.

Rudy Project — R750 off
  How to claim: at the Rudy Project stand in the race village.

Green Motion — 15% off
  Code: REDCHERRY15   →  greenmotion.co.za
```

Rules it follows:
- Only offers that are live (active, not expired) and that match the rider's event appear — the same rules the app uses, so the email can never advertise a dead or wrong-event offer.
- Offers with a code show the code prominently plus the partner link; offers without a code show the redeem instructions instead (this keeps the Cycle Lab cell-number wording identical to the app).
- If an event has no live offers, the block is simply left out.
- Offers are managed only in Admin → Supplier promos; editing there changes the emails too, with no code change.

## Test email

A "Send test welcome email to me" button on the Entry Ninja admin page. It renders the real template using a chosen upcoming event's details and the offers live on it, and sends it to the signed-in admin's address. It does not touch anyone's entry records or mark any real entry as emailed.

Once approved I'll run it and send the test mail to shaun@redcherryevents.co.za.

## Technical notes

- `src/lib/entry-welcome.server.ts`: load active rows from `public.promos` once per batch, and for each entry filter with the existing `isPromoLive` / `promoMatchesEvent` helpers against the event name; pass a compact `offers` array (brand, title, blurb, code, redeem, discount, url) in `templateData`.
- `src/lib/email-templates/entry-welcome.tsx`: new optional `offers` prop plus an "Your rider offers" card rendered before the footer, styled with the existing `card` / `cardTitle` tokens; added to `previewData` so the dashboard preview shows it.
- New admin-only server function (`sendTestEntryWelcome`) in the existing Entry Ninja functions file: verifies the caller's admin role, builds template data from the selected event, and calls `sendTemplateEmail("entry-welcome", <admin email>)` with a unique idempotency key.
- No database changes, no changes to promo matching, and no changes to when entry emails are sent.
