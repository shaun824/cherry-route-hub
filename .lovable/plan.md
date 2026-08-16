# Security follow-up: RLS + ID number handling

## Where things actually stand

I checked the database and the code before writing this.

**Row Level Security:** already enabled on all 32 tables in the app's database, and every one of them has policies. Rider data (entrants, event entries, rooming, profiles) is locked to "your own row", plus admin and crew read policies via security-definer role checks. So the first point is essentially already done — no table is publicly readable by accident.

**ID numbers:** you are *not* storing ID numbers. The database keeps only a one-way hash (`id_number_hash`) plus the last 4 digits. Raw ID numbers are never written to a table and never sent to the browser. So "you're exposing people's IDs" isn't literally true of storage.

The real, fair criticism is one specific endpoint: the sign-in helper where anyone — not signed in — can post an ID number and get back a masked email ("s••••@gmail.com") for that person. That is an **enumeration oracle**: SA ID numbers are guessable (date of birth + sequence + checksum), so a script could walk through candidate IDs and learn which ones are registered for our events, and get an email hint for each. That, not the storage, is what needs fixing.

You can absolutely keep ID number as the thing riders type in. It just needs to stop behaving like a public lookup service.

## What I propose to change

### 1. Harden the pre-login ID lookup
- Require **ID number + surname** together (surname compared case/space-insensitively against the roster). Guessing an ID alone stops being enough.
- Return a uniform response on any failure — same message, same timing — so an attacker can't tell "wrong ID" from "wrong surname" from "not registered".
- Rate limit by IP and by ID hash: a small number of attempts per 10 minutes, then a cool-down. Attempts logged so we can see abuse.
- Never return an email hint until both factors match; masked hint stays as-is after that.

### 2. Harden the entry-claim step
Today, signing in and supplying a matching ID claims that roster row. Same surname requirement applies, plus the existing rules stay (can't claim a row already linked to another account, ID hash must match).

### 3. Keep the ID out of logs and URLs
Audit that the ID number is only ever sent in a POST body, never in a query string, never logged, never stored in localStorage longer than the sign-up hand-off (it currently sits in `localStorage` between sign-up and confirmation — I'll move that to `sessionStorage` and clear it immediately after linking).

### 4. Small privacy tidy-ups
- Drop `id_number_last4` from anything the browser can read (admin screens can show it; riders don't need it).
- Add a short note on the sign-in screen explaining we only store a scrambled version of the ID, which is what regulators (POPIA) expect you to disclose.

## Technical notes

- Files touched: `src/lib/id-lookup.functions.ts`, `src/lib/roster.functions.ts` (`linkMyEntry`), `src/routes/auth.tsx`.
- New table `id_lookup_attempts` (ip hash, id hash, timestamp, outcome) with RLS: no client access at all, service-role only; used purely for rate limiting and cleaned up after 24 hours.
- Surname match uses the existing `entrants.full_name`, normalised (lowercase, strip accents/punctuation, match last word or any word).
- No change to the hashing scheme, so existing roster rows keep working.

## What I will not do

- Remove ID-based sign-in. It stays, because it's the identifier riders know and it's what ties them to their Entry Ninja registration.
- Store raw ID numbers. Hash-only stays.

## Reply you can send back

"RLS is enabled on every table with per-user policies; ID numbers are never stored in plaintext, only a one-way hash. The pre-login ID lookup has been changed to require ID + surname, with uniform responses and rate limiting, so it can no longer be used to enumerate registrations."
