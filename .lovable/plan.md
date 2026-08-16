# Link rider entries to spots on the village map

Goal: every person on a rooming list is tied to their real event entry and to a place on the village map, so crew can find anyone's tent in seconds and riders can tap "Show me my tent" and see exactly where they sleep.

## How it will work

**1. Entry linking (Entry Ninja)**
Each rooming row gets matched to the rider's actual entry for that event, not just a name in a spreadsheet. Matching runs in this order, first hit wins:
1. Registration reference / Entry Ninja ref
2. Email
3. ID number last 4 + surname
4. Full name (exact, then fuzzy)

Anything that doesn't match lands in an **Unmatched** queue in Admin → Rooming, where you pick the right entry from a dropdown (or mark it "guest / not an entrant"). Matches are stored, so re-syncing the Google Sheet keeps them.

**2. Placement: area by default, tent pin when you want it**
- Every rooming row is placed on a drawn area (zone) as today, matched on the "area" or tent column.
- New: a **tent pin** layer. In the village editor you can drop a numbered pin for a specific tent (e.g. "Tent 42") inside an area. Any rooming row with that tent number automatically attaches to that pin.
- A tent-range rule (e.g. "Tents 1-40 → Nyathi Camp") lets you place a whole block in one go without pinning each tent.
- Placement precedence for a person: exact tent pin → tent-range rule → area → venue point.

**3. Rider view ("find my accommodation")**
On the event page, the Accommodation card resolves through the linked entry (so it works even when the rooming sheet has no email). "Show me on the village map" opens the map zoomed to their tent with a pulsing marker, their tent number, roommates, walking hint and a "navigate here" link.

**4. Crew view ("find this person's tent")**
- Search by name, tent number, bib, registration reference, or ID last 4.
- Result shows tent, area, venue, roommates and a map button that zooms straight to the pin.
- Tap any area on the crew map to list everyone sleeping in it (with tent numbers), plus a count.
- Area occupancy summary per event: allocated / unmatched / unplaced.

**5. Admin tools**
- Rooming table gains: linked entry status, tent pin column, bulk "auto-place" and "auto-link" buttons with a report (X linked, Y placed, Z need attention).
- Village editor gains a tent-pin mode with numbering, plus drag to reposition.
- Assign or move a person to an area/pin by tapping the map.

## Technical notes

- `event_rooming` gains `event_entrant_id` (FK to `event_entrants`), `village_tent_id`, and `match_source` (auto/manual/none). Existing `village_zone_id` / `village_spot_id` stay.
- New `event_village_tents` table: `id, event_id, label, lat, lng, zone_id, capacity` — the tent pin layer, drawn in the existing geo editor.
- New `event_village_tent_rules`: `event_id, zone_id, pattern` (range or prefix) for bulk placement.
- Matching logic lives in a shared `src/lib/rooming-match.ts` (pure, testable) used by both the Google Sheet sync (`rooming-sync.server.ts`) and the admin CSV import, so both paths behave the same.
- Rider resolution moves from "email or entrant_id" to entry-first lookup in `fetchMyRooming`, with the old paths as fallback.
- Crew search extends `src/lib/crew.ts` to join entry fields (bib, reg ref, ID last 4) with an RLS policy limited to the crew role; riders keep seeing only their own row.
- Map components (`village-map-geo`, `village-map-view`, `village-map-editor-geo`) render the new tent-pin layer and support focus-on-tent, reusing the existing highlight/pulse styling.

## Build order

1. Database changes + match helper with tests
2. Auto-link and auto-place on sheet/CSV sync, plus admin unmatched queue
3. Tent-pin layer in the village editor and rules
4. Rider "show me my tent" upgrade
5. Crew search + tap-an-area occupancy list
