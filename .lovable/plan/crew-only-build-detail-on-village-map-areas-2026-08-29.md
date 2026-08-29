# Crew-only build detail on village map areas

Today the areas you outline on the village map only carry a name, colour and size. This adds a crew-only description of what each area is and what goes in it — Bedouin tent, speed fencing, candy-taped area, gazebo row, etc. Riders never see any of it.

## What you get

**In the admin village builder (per area):**
- Area type picker: Bedouin tent, Marquee, Gazebo row, Speed fencing, Candy tape / cordon, Barrier line, Parking block, Camping block, Signage / branding area, Vehicle / plant, Other.
- "What it contains" field — free text spec, e.g. "1 × 10m × 15m Bedouin, 12 tables, 60 chairs, 4 × light strings".
- Crew notes field — build/strike instructions, e.g. "Anchor with water barrels, open ends facing north".
- These sit next to the existing name/colour/size controls for the selected area.

**On the crew/admin map view:**
- Areas with build detail get a tappable label; tapping zooms to the area and opens a card showing type, contains, notes and measured size.
- A new "Build areas" section beneath the existing Build list, grouped by area type, showing each area's size and contents — so it doubles as a load-out sheet.
- Everything above is gated to signed-in crew and admins, exactly like the existing Infrastructure and Branding layers. Riders keep seeing plain coloured outlines with no labels or detail.

## Technical notes

- Extend `VillageZone` in `src/lib/village-zones.ts` with optional `kind`, `spec` and `crewNotes`, plus a `ZONE_KINDS` list (id, label, default colour). Zones are stored inside the existing `event_village_maps.zones` JSON, so no migration is needed and existing areas keep working (no kind = untyped area).
- Editor UI: add the three fields to the per-area panel in `src/routes/admin.village.$eventId.tsx`, wired through the existing `updateZone`/`patch` helpers so the unsaved-changes guard picks them up.
- Map: in `src/components/village-map-geo.tsx` accept a `zonesInteractive`/`onZoneSelect` prop; when on (crew view only) render zone polygons as interactive with a centroid label and selection callback, reusing `zoneCentroid` and the existing `FlyToZone` behaviour. Rider view keeps `interactive={false}` and no labels.
- `src/components/village-map-view.tsx` already computes `isCrew`; use it to pass the interactive flag, render the zone detail card, and add the "Build areas" list using `zoneSizeM`/`zoneAreaM2` for sizes.
