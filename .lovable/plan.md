# Best-in-class Village Map interaction pass

## Goal
Make the rider and crew village maps feel predictable and map-native: measured focus instead of forced close-ups, context-aware touch gestures, complete full-screen controls, progressive readable labels, and consistent behavior across live satellite and Plan views.

## Implementation

### 1. Measured focus for points, tents, and areas
- Replace the three fixed zoom jumps with one shared Leaflet focus controller.
- Keep the current zoom when the target is already inside a comfortable visible region and its nearest neighbour is visually separated.
- When markers overlap, calculate their screen-space separation at candidate zooms and move only the minimum number of levels needed, capped at zoom 21.
- Account for the full-screen detail sheet by centring selected content in the unobscured portion of the map.
- Use the same rule for facility chips, map markers, tent deep-links, build-area labels, and crew build-list selections.
- Give Plan view the equivalent measured focus: retain the current scale for isolated, visible points and increase only enough to separate nearby pins, instead of always forcing scale 3.

### 2. Context-aware gestures and reliable full screen
- Keep cooperative two-finger panning and its one-time hint in inline live-map cards.
- Enable one-finger panning immediately in full screen and suppress the hint there.
- Rework Plan view panning so inline touch uses two fingers while full screen uses one finger; keep pinch centred under the fingers and keep desktop scrolling/dragging usable.
- Standardise expand/exit controls in the top-right for both modes.
- Add safe-area spacing to top and bottom controls, and shift lower controls above an open detail sheet.
- Exit full screen with Escape and with browser/Android back without leaving the event page; clean up the temporary history entry on button exit.
- Recalculate map/image dimensions when entering or leaving full screen so controls, points, and imagery remain aligned.

### 3. Progressive, collision-aware labels
- Add a shared label-layout helper that measures projected marker positions and estimated label boxes.
- Keep the normal overview icon-only. At higher zoom, progressively place non-overlapping names; selected and hovered labels always win.
- Rank rider-critical facilities first, then ordinary rider points, then crew infrastructure/branding. Recalculate after settled pan, zoom, layer, or viewport changes.
- Keep tent labels under the existing clean-map zoom rule and include visible tents and build-area labels as collision obstacles in dense crew views.
- Apply the same priority and collision rules to Plan view, where pins currently always include text.

### 4. Crew-specific readability
- Make build-area labels participate in collision placement rather than always rendering over facilities.
- Keep the Build areas and Build list panels as the complete reference; on-map labels remain contextual and selected items remain guaranteed visible.
- Preserve all editor drag, resize, rotate, and placement behavior. Only share the collision/focus rules where the editor displays dense labels; do not alter placement geometry or saved data.

## Technical details
- Add small client-side helpers for focus calculations, projected spacing, label priority, and rectangle collision; no database or data-model changes.
- The live map will expose its settled viewport to label layout and will use Leaflet projection APIs for exact screen-space decisions.
- Plan view will track explicit pan offsets rather than relying on scroll overflow, allowing the same one-/two-finger policy and cursor/finger-anchored zoom math.
- Full-screen browser-history handling will add one temporary same-page state and consume it on Back; Escape and the exit button use the same close path.
- Existing rotation, live location, layer filtering, viewport culling, tent visibility, and detail content remain intact.

## Verification
- In the actual preview, test clustered and isolated facilities, tents, and build areas at several zooms.
- Verify labels appear progressively without overlap in rider mode and with all crew layers enabled.
- Verify two-finger inline behavior and one-finger full-screen behavior in both map modes.
- Verify Escape, browser/Android Back, safe areas, controls, and bottom-sheet clearance at desktop, portrait phone, and small landscape phone sizes.
- Verify the admin editor still supports pin/tent/area placement and dragging without jumps.
- Run targeted type checks and confirm the latest preview build and browser console are clean.
