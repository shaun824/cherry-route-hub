# Find my entry email by ID number

Riders often forget which email address they used on Entry Ninja. Add a helper on the sign-in page: enter your ID number, get back a masked version of the email we have on file for you, so you know which address to sign in with.

## Rider experience

On the sign-in page, under the email/password form, a small link: "Not sure which email you used?"

Opening it reveals one field for the ID number and a "Find my email" button. Results:

- Match found: "We have an entry under s••••n@g••••l.com — sign in with that address." Plus a "Use this address" hint (the field can't be prefilled with a masked value, so it's guidance only).
- No match: "No entry found for that ID number. Check the number, or contact us and we'll help." Same wording whether the ID is unknown or has no email, so nothing is leaked.
- More than one entry with different emails: list each masked address.

Masking rule: first and last character of the local part kept, first and last of the domain name kept, extension kept in full. `shaun@redcherryevents.co.za` becomes `s••••n@r••••••••••••••s.co.za`. Short parts fall back to a single visible character.

## Safeguards

- Only an exact match on the full ID number works — no partial or last-4 lookups, so the form can't be used to enumerate riders.
- Minimum length enforced on the input; whitespace and case normalised the same way the roster import does it.
- Never returns names, events, or the plain email — only the masked string.
- Simple per-request throttle: a short server-side delay on misses plus a client-side cooldown between attempts to discourage bulk guessing.

## Technical notes

- New server function file `src/lib/id-lookup.functions.ts` with a public (unauthenticated) `lookupEntryEmail` created via `createServerFn`, validated with Zod.
- Handler dynamically imports `hashIdNumber` from `src/lib/id-hash.server.ts` (same salt used at roster import) and the service-role client from `@/integrations/supabase/client.server`, since `entrants` is not readable by anonymous users. It selects only `email` rows matching `id_number_hash`, masks them server-side, and returns `{ emails: string[] }` — the raw email never leaves the server.
- The file stays a thin wrapper: masking helper lives in a separate module (`src/lib/mask-email.ts`) so server-function splitting is safe.
- UI added inside the existing `/auth` route component (`src/routes/auth.tsx`) as a collapsible section, styled with the existing card/input classes. No route or schema changes.

## Limitation

This only works for riders whose ID number came through an Entry Ninja roster import. Anyone not yet in the roster gets the "no entry found" message.
