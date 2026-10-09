# Weekend Warrior podiums on the results page

A "Prize giving" section on the Weekend Warrior results page. What it shows changes over the weekend.

## The three stages

```text
Before the race      ->  After Day 1 (stage 1)        ->  Sunday 12:00 prize giving
Prize categories        Provisional podium              Final podium
(no names)              (top 3 after stage 1,           (you check it and press
                         marked "Provisional")           Publish, then it shows)
```

1. **Before the race:** shows the podium categories copied from the Weekend Warrior prize-giving page:
   - Bronze: U/14 Male and Female
   - Silver: U/14 and Adult, Male and Female
   - Gold: Adult Male and Female
   - Gold E-Bike: Adult Male and Female
   - Prize giving is on Sunday at 12:00, and only Weekend Pass holders qualify.
2. **After stage 1:** once Day 1 timing results come in, each category shows the current top 3 with a clear "Provisional" label. This updates as results change.
3. **Final:** the combined two-day top 3 is worked out automatically. It only appears for riders once you approve it, and never before Sunday 12:00. Until then they keep seeing the provisional podium.

## Admin: Podium check (on the Results admin page)

- Shows each category's proposed top 3 next to the next few riders, so you can check them.
- You can swap a rider, remove one (for example a disqualified rider), or fix their category.
- Pressing **Publish final podium** fixes the winners. They show from Sunday 12:00, or straight away if you publish after that.
- **Unpublish** takes the final podium down again if something is wrong.

## Who qualifies

- Only Weekend Pass riders. Day-pass classes are left out.
- U/14 or Adult, and Gold/Silver/Bronze/E-Bike, come from the rider's entry class.
- Male or Female comes from the gender riders gave on their Entry Ninja entry. The app does not store gender yet, so the next Entry Ninja sync will start saving it. Riders with no gender recorded appear in a "Gender missing" list on the admin page, so you can fix them before publishing.
- Day-pass riders and anyone missing a two-day time are left out of the final podium.

## Technical details

- New `gender` column on `event_entrants`, filled by the Entry Ninja sync writers. A one-off re-sync for Weekend Warrior fills it in.
- New table `event_podiums` (one row per event): `final` JSON of categories and riders, `published_at`, `reveal_at` (defaults to Sunday 12:00 SAST), `published_by`, plus the GRANTs and RLS. Anyone can read a row only when it is published and `reveal_at` has passed; only admins can write.
- The podium categories are stored as event config (`events.podium_config` JSON), with Weekend Warrior seeded from the prize-giving page. This lets other events reuse the same feature later.
- The provisional and proposed podiums are worked out on the server from the existing results feed (Myriad, or imported results) plus the entrant class and gender. A public server function returns only names, race numbers, positions and times.
- UI: a new `PodiumSection` on the event results page; podium review in `admin.results.tsx`.
