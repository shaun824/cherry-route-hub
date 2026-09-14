# Live results from Myriad Events

Right now results only get into the Rider Hub by uploading a spreadsheet. The guide you sent describes a public results feed from Myriad Events (events.myriadevents.co.za) that we can read directly, so results appear in the app automatically while the race is running.

## What you need from Myriad Events

One thing per event: the **RaceId** number for that race (for example 214997). The feed cannot search by name, so it has to be given to us. Nothing else — no password or key, the feed is public.

## What you'd get

- **Admin**: a "Race number (Myriad)" field on each event, a "Check feed" button that shows the race name, date and the list of races inside it, and a switch to publish results to riders. The existing spreadsheet upload stays for events not timed by Myriad.
- **Riders and supporters**: the event's Results tab fills itself — one section per race within the event (e.g. Gold, Silver, Bronze), position, race number, name, category, finish time and pace.
- **Search a rider**: find by surname or race number across the whole event, with their lap-by-lap splits when the timer records them.
- **Live**: results refresh about every 60 seconds during the event, and provisional results are labelled as such so nobody treats them as final.

## How it works behind the scenes

Feed shape: a Race contains Events (the individual start groups), each Event has one or more Result Sets, each set has rows. Only the RaceId is stored; the inner ids change per edition and are looked up each time.

- `events`: add `myriad_race_id text` (nullable).
- New server functions in `src/lib/results.functions.ts`:
  - `fetchMyriadRace({ raceId })` — `GET /Rest/race/{id}?format=json`, returns race name/date/timezone and its events. Used by the admin check button and as step 1 of every read.
  - `fetchMyriadResults({ eventId })` — for each inner event, `GET /Rest/race/{id}/results?format=json&event_id=…` with paging (`page`/`results_per_page`, stop at `num_finishers`), normalised into the existing `ResultSet` / `ResultRow` shapes so the current results table and rider pages need no change.
  - `findMyriadParticipant({ eventId, lastName | bib })` — same call with `last_name` / `bib_num`, keeps sets that return rows.
- Normalisation helpers in `src/lib/results.server.ts`: map `place → position`, `bib → bib_number`, `first_name + last_name → full_name`, `clock_time`/`chip_time` → `time_text` + `time_ms` (reuse `parseTimeMs`), everything else into `extras` using `results_headers` labels. Custom columns arrive as `custom-field-NNNNNN` keys that change per set, so resolve them by label, including the tab/newline "Lap Details" table which is parsed into lap/time/pace/distance rows.
- Error handling: the feed returns HTTP 200 with a top-level `error` object, so every response is checked for that before reading data; failures fall back to the stored/imported results or the external results link.
- Caching: feed responses are cached 30 seconds upstream; we cache in-process for 30s and the rider page refetches every 60s, with `modified_after_timestamp` used on refreshes so only changed rows come down.
- `getEventResults` gains a source switch: Myriad feed when a RaceId is set, otherwise the imported rows as today.

## Not included now

Writing feed results back into the database (only needed if you want results to survive when Myriad takes a race offline) — can be added later as a nightly snapshot.
