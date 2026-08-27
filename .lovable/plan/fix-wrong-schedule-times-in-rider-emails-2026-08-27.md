# Fix wrong schedule times in rider emails

## What went wrong

Your email said Silver starts 12:30 (Sat) and 08:30 (Sun). The website says Silver starts **12:35** and **08:05**, and there is a whole **Friday 16 October** registration afternoon (13:30–17:30) that the app doesn't have at all.

The email itself is fine — it printed exactly what is stored on the event. The bad data came from the automatic website schedule scrape, which last ran on 27 Aug and stored:

- All three tiers starting at the same time (12:30 Sat, 08:30 Sun) — the real page lists 12:25 / 12:30 / 12:35 / 12:40 and 07:55 / 08:00 / 08:05 / 08:10
- No Gold E-Bike start
- No Friday registration day at all (event days start Saturday)

The sources it used were Weekend Warrior pages for **other legs** (Worcester, Grabouw) plus generic FAQ/route pages — not the Lourensford schedule page. So the AI filled in plausible-looking times instead of the real ones.

## The fix

**1. Correct Weekend Warrior Lourensford now**

Rebuild the event days and schedule exactly as the website states:

```text
Registration Day · Fri 16 Oct   13:30–17:30  Registration, number collection, tented village allocation
Day 1 · Sat 17 Oct              09:30–11:30  Registration (MTB, Weekend Pass & Day Riders)
                                12:25        Gold E-Bike start
                                12:30        Gold start
                                12:35        Silver start
                                12:40        Bronze start
Day 2 · Sun 18 Oct              06:30–08:00  Registration (Day Riders)
                                07:55        Gold E-Bike start
                                08:00        Gold start
                                08:05        Silver start
                                08:10        Bronze start
                                12:00        Prize giving (all categories)
```

**2. Stop the scraper guessing (so it can't happen on any event)**

- Only crawl pages that belong to this event's own leg/edition; drop pages whose URL or heading names a different town or edition.
- Require every extracted time to appear verbatim in the source text — anything the AI produces that isn't literally on the page gets dropped rather than saved.
- Preserve time ranges ("13:30 – 17:30") instead of collapsing them to a single time.
- Never merge separate batch starts into one time: each tier line stays its own item with its own time.
- Record the exact source URL and quoted line behind every schedule item.

**3. Don't email unverified times**

- Times only appear in rider emails once the schedule has passed the verbatim check and is marked verified.
- If an event's schedule isn't verified yet, the email shows the day-by-day shape with "Times confirmed closer to the event" instead of guessed times — same standard on every event.
- Admin gets a "Schedule needs review" flag on any event where the scrape found nothing, found conflicting times, or changed times since last approval.

**4. Re-check every upcoming event**

Re-run the corrected scrape against all upcoming events and list, for each one, which times were confirmed verbatim against the site and which need a human look before they go into emails.

**5. Send you a corrected Weekend Warrior test email** showing Silver at 12:35 / 08:05 and the Friday registration day.

## Technical notes

- Data fix on `events.days` (add the Fri 16 Oct day) and `events.schedule` for `2dc4fd8c-c1f0-45b3-b5cd-61a3644f7fa7`.
- `src/lib/schedule-scrape.server.ts`: leg-aware page filtering in `pickPages`, verbatim time validation after `extractSchedule`, range preservation in `normaliseTime`/`toScheduleItems`, per-item source capture.
- `event_schedule_sync`: add a verified/needs-review state; the daily cron sets it, admin approves in Admin → Schedule sync.
- `src/lib/entry-welcome.server.ts`: `riderScheduleForEmail` reads times only from a verified schedule, otherwise falls back to the TBC shape already in place.
