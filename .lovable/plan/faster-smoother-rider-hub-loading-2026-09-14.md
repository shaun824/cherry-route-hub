# Faster, smoother Rider Hub loading

## Goal
Make startup and page changes feel immediate. Keep the Rider Hub loading screen only for genuinely slow waits, without letting unfinished pages flash or jump.

## Changes
- Replace the always-on startup animation with a short grace period: render the page immediately, and show the loading screen only if the page is still waiting after roughly 250 ms.
- Remove the forced 1.6-second startup animation, 500 ms navigation minimum, and global waiting for every font and picture.
- When the loading screen is needed, keep it visible only until the destination is ready, then use a short smooth fade with no extra hold time.
- Prevent brief background refreshes and normal live-data polling from triggering the full-screen loader.
- Keep the existing Rider Hub · Preparing to Start branding and reduced-motion support.
- Reduce initial work by loading non-essential global features only when needed, especially the assistant and password prompt.
- Review route loading and large eager imports, then apply only safe, high-impact improvements that do not change rider, crew, or admin behavior.

## Verification
- Measure cold startup and several rider, crew, and admin page changes before and after.
- Confirm fast pages never flash the loader, while genuinely slow pages remain covered until their main content is usable.
- Check mobile and desktop for jerky fades, content flashes, layout jumps, blocked taps, and repeated loader appearances.
- Confirm embeds remain loader-free and the app still builds cleanly.

## Technical details
Use a delayed-overlay state machine driven by actual router loading, with cancellable timers and a maximum safety timeout. Remove query-wide `useIsFetching` and document-wide image/font scans from the critical path. Lazy-load optional root features behind React suspense boundaries where safe.
