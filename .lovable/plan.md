# Build & branding layers on the village map

Turn the village map into a field-build tool: admins place infrastructure and branding items on the same satellite map they already use for rider points, and crew see those items on their own map — riders never do.

## What you get

**Three layers on one map**
- Rider points (what exists today: registration, food, toilets…) — everyone sees these.
- Infrastructure — generators, distro boards, water points, fencing, lighting towers, cable runs, marquees, gazebos, toilets/skips delivery spots.
- Branding — flags, banners, sponsor boards, start/finish arches, directional signage, feather flags.

Infrastructure and Branding are crew + admin only. Each layer has its own toggle, so on build day you can look at just branding, just power, or everything at once.

**Each build item captures**
- Title and type (generator, flag, gazebo, sign, banner, fence line…)
- Quantity and size — free text, e.g. "3 × 3m gazebo", "60kVA", "6m banner"
- Notes
- Colour/icon per type so the map reads at a glance

**Admin editing**
In Admin → Village, a layer switcher above the map: Rider / Infrastructure / Branding. Placing, dragging, editing and deleting works exactly as it does now for rider points — you're just placing into a different layer. Drawn zones (which already measure area in metres) stay available for footprints like the expo field or camping blocks.

**Crew view**
The crew village map gets the same layer toggles plus a build list beneath it: every infrastructure and branding item grouped by type with quantity and size, so it doubles as a pack/checklist for the truck. Tapping an item zooms and centres it, same as the rider map does now.

**Rider view unchanged**
Riders and spectators see only rider-layer points; the extra items are filtered out before render.

## Technical notes

- Extend `VillageHotspot` in `src/lib/village-map.ts` with `layer?: "rider" | "infra" | "branding"` (absent = rider, so all existing data keeps working) and `spec?: string` for quantity/size. No migration needed — hotspots are stored as JSON on `event_village_maps`.
- Add build categories and icons to `src/lib/village-icons.ts` (generator/fuel, flag, sign, gazebo/canopy, fence, lighting, water, cable, arch, banner) and extend `VillageCategory`.
- `src/components/village-map-view.tsx`: new `layers` state; filter hotspots by layer before passing to `VillageMapGeo` and the chip row. Crew/admin gate via the existing `useIsAdmin` hook plus crew-role check; non-crew get rider-only with no toggles rendered.
- `src/components/village-map-editor-geo.tsx` + `src/routes/admin.village.$eventId.tsx`: layer selector controls which layer new points are added to and which are shown/editable; the point-edit form gains Layer and Quantity/size fields.
- A `BUILD_TEMPLATE` alongside the existing `VILLAGE_TEMPLATE` so a new event can be seeded with the standard Red Cherry build kit and then dragged into place.
- Crew build list rendered in `src/routes/crew.rooming.tsx`'s map section (or a dedicated crew build tab) reusing the existing focus-and-zoom behaviour.
