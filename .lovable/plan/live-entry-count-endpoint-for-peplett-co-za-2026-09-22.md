# Live entry-count endpoint for peplett.co.za

Add a public, read-only numbers endpoint the WordPress site can call to show live PE Plett entry numbers.

## What you get

A URL like:

`https://riderapp.redcherryevents.co.za/api/public/entry-count`

returning JSON:

```json
{ "event": "PE Plett 2027", "taken": 172, "paid": 57, "cap": 250 }
```

- `taken` — everyone on the event roster (entered).
- `paid` — riders whose entry is marked paid (the real "sold" number).
- `cap` — defaults to 250; changeable per event via `?cap=`, or hard-coded per event.

Options: `?event=<other event id>` makes it reusable for future events; `?paid=1` counts only paid riders as `taken`.

## Why it differs from the snippet you were given

- That snippet uses an older routing style (`createServerFileRoute`) — this app uses `createFileRoute` with a `server.handlers` block.
- It pointed at the `entries` table, which is empty. Real rider counts live in `event_entrants` (PE Plett: 172 rostered, 57 paid).
- The endpoint goes under `/api/public/*` so it works on the published site without sign-in.

## Build

1. **New route** `src/routes/api/public/entry-count.ts`:
   - `GET` handler: parse `event`, `cap`, `paid` query params (validated), count `event_entrants` rows for the event (head-only count query, no rows fetched). Server-side count via the privileged backend client loaded inside the handler — nothing but two numbers is ever returned, so no rider data can leak; no new database permissions needed.
   - Response headers: `content-type: application/json`, `access-control-allow-origin: *` (WordPress can read it from the browser), `cache-control: public, max-age=60` (busy pages can't hammer the database).
   - `OPTIONS` handler returning 204 with the same CORS headers.
   - Invalid/unknown event id → `404` JSON error, no data.
2. **WordPress snippet** (I give you the finished HTML/JS to paste): a small script that fetches the endpoint once a minute and writes the numbers into your page, e.g. a "157 of 250 entries taken" bar. Plain JavaScript, no plugins needed.
3. No database migration, no schema change, no new permissions — code only.

## Notes

- One minute of caching means the number can lag real entries by up to ~60 seconds.
- Works on the preview URL immediately; needs a publish before peplett.co.za can use the live custom-domain URL.
