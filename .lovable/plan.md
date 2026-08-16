# Cherry Miles v2 — loyalty program design

Reshape the existing Cherry Miles program around a 5% give-back budget, a four-way reward mix, rolling 3-year tiers, and 24-month expiry.

## What the data says

Verified against the live database:

- 538 people, 185 participation rows across 7 valued events.
- Entry fees R1 150 → R18 500, average ~R8 260.
- Only 1 rider currently shows more than one event — the Entry Ninja backfill is still shallow (7 events valued out of a much longer history), so repeat-rate is not yet measurable. Extending the backfill is step 1, because tiering on a rolling window is meaningless until multi-year history is in.

## The economics

Target: about 5% of entry revenue returned as reward value.

- Earn: 1 Cherry Mile per R10 of entry fee (unchanged, 0.1 pt/R1).
- Redeem: 1 Mile = R0.50 of reward value. R8 260 entry → 826 Miles → ~R413 back (5.0%).
- Hero events (PE Plett) keep the 2x earn multiplier. That pushes PE Plett to ~10% — deliberate, it is the flagship and the repeat-purchase hook. All other events stay at 5%.
- Returning-rider bonus stays, but is folded into the 5% budget rather than added on top.

Because merch and experience rewards cost you COGS rather than retail, pricing them at retail-equivalent Miles means the true cash cost of the program lands nearer 3% while riders perceive 5%. That is the standard industry play and the reason to push riders toward merch over cash-off.

## Reward mix

Four reward kinds, each priced in Miles:

| Kind | Example | Miles | Real cost to you |
|---|---|---|---|
| Entry discount | R150 / R500 / R1 000 off | 300 / 1 000 / 2 000 | Full rand value |
| Merchandise | Tee, cap, jersey | Priced at retail value | COGS only |
| Experience | Priority tent, VIP registration, guest pass, early-entry window | 400–1 500 | Near zero |
| Partner offer | Green Motion, Cycle Lab, Rudy Project | 0–200 | Sponsor funded |

Merch and experience rewards get prominence in the rider UI; entry discounts sit last so the cheap-to-serve rewards get chosen first.

## Tiers — rolling 3 years

Tier is earned on Miles accrued in the last 36 months, not lifetime. Lifetime balance still shows as the spendable total.

| Tier | 3-yr Miles | Perk |
|---|---|---|
| Bronze | 0 | Hub access, partner promos |
| Silver | 500 | Early entry window |
| Gold | 1 500 | Priority tent placement, merch discount |
| Cherry Elite | 3 500 | VIP registration, guest pass |

Add a status-hold rule: a tier is held for 12 months after the rider drops below its threshold, so someone who skips a season does not fall off a cliff.

## Expiry

- Miles expire after 24 months of inactivity — no event entered and no redemption in that window wipes the balance.
- Riders see "X Miles expiring on <date>" once inside 90 days, plus a push notification.
- Coupons keep the existing 12-month validity.

## Technical section

1. **Deepen the backfill** — raise the Entry Ninja event scan beyond the current 60-event / valued-7 state so multi-year history exists; re-run price-based valuing so every event has an entry price rather than falling back to the 100-point default.
2. **Settings** — extend `LoyaltySettings` in `src/lib/loyalty.ts` with `randPerPoint: 0.5`, `tierWindowMonths: 36`, `tierHoldMonths: 12`, `expiryMonths: 24`. Admin controls added in `/admin/loyalty`.
3. **Tiers** — `tierFor()` takes a rolling-window point total; a new helper computes 36-month Miles from `loyalty_ledger` dated rows. Rewards summary and `/rewards` show both rolling tier progress and spendable balance.
4. **Reward kinds** — add `kind` (`entry` | `merch` | `experience` | `partner`), `stock`, and `fulfilment_notes` to `loyalty_rewards` via migration; admin editor and the rider catalogue group by kind.
5. **Expiry** — nightly/weekly job writes negative `expire` ledger rows for balances inactive 24 months; rider UI surfaces the upcoming-expiry warning.
6. **Admin liability view** — `/admin/loyalty` shows outstanding Miles at cash cost vs COGS cost, split by reward kind, so you can see the real exposure.

Entry Ninja still has no discount-code API, so entry-discount coupons remain "load manually" until they enable it. Merch and experience rewards redeem entirely in-app with a QR/code shown at registration, which is another reason to lead with them.
