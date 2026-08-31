# Foolproof entrant-to-account linking

## What already happens
- Every Entry Ninja sync run (4x daily) calls `linkEntrantsToAccounts`, which links unlinked entrants to profiles by email.
- The admin rider profile page falls back to matching by email, so entries show even before linking.

## Remaining gaps
1. A rider who signs up between sync runs stays unlinked for hours (Joe's case).
2. A rider whose Entry Ninja email differs from their app sign-up email never links at all.
3. No visibility into who is still unlinked.

## Changes

### 1. Link on every sign-in
- New server function `linkMyEntrants` (in `src/lib/entryninja.functions.ts`, authenticated): matches `entrants` rows with no `user_id` to the caller by their account email (case-insensitive) and sets `user_id`.
- Call it once after auth resolves in the app shell (`AppShell` or the auth gate), so linking happens instantly at sign-in instead of waiting for the next sync.

### 2. ID-number claim for mismatched emails
- Entrants already store `id_number_hash` / `id_number_last4`. Add a "Can't see your entry?" claim flow on the My Events / profile screen: rider enters their SA ID number, server hashes it and links any matching unlinked entrants to their account.
- Rate-limit attempts via the existing `id_lookup_attempts` table to prevent guessing.

### 3. Admin unlinked-entrants report
- On the admin riders page, add a small "Unlinked entrants" count/list (entrant name, email, events) so you can spot riders who entered but never signed in or used a different email — one click to open their profile fallback view.

### Verification
- Sign in as a test rider whose entrant row is unlinked → entries appear immediately without waiting for a sync.
- Claim flow links by ID number and rejects wrong numbers.
- Admin report lists remaining unlinked entrants.
