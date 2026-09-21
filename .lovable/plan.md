# Two apps, or one faster app?

## Short answer

Splitting crew and rider into two apps would be a big job and would **not**
make the rider side meaningfully faster. The rider pages already only download
their own code — crew and admin screens are never sent to a rider's phone. The
slowness riders feel comes from a few shared things that load on every page,
and those follow you into a second app.

Recommendation: keep one app and one database, and do a focused speed pass.
If you still want a separate crew experience later, we can give crew its own
installable icon and start screen without duplicating the codebase.

## What splitting would actually cost

- Two deployments, two domains, two publish steps for every change.
- Shared pieces (rider records, event info, village map, assistant, emails,
  sign-in, uploads, Entry Ninja and results syncs) would need to be kept in
  step across two codebases, or moved into a shared library — weeks of work
  plus ongoing double maintenance.
- Your data is safe either way: both apps would read the same database, so
  rider details, manual uploads and API-synced info stay in one place.
- Real benefit is limited to: a separate app icon for staff, and a cleaner
  crew-only navigation. Both are achievable inside the current app.

## What will actually make the rider side faster

1. **Trim what loads on every single page.** The shell currently wires up
   pull-to-refresh, entry auto-sync, crew checks, analytics, the offline
   worker, install prompt and the assistant on every route — including pages
   that don't need them. Defer these until after first paint, and skip
   crew-only checks entirely for riders.
2. **Stop crew/admin work running for riders.** The crew-role lookup and
   entry auto-sync fire for everyone. Gate them to the pages that use them.
3. **Split the heavy screens.** A handful of very large pages (the event hub,
   village editor, events admin) pull in maps, charts and spreadsheet tools.
   Load those parts only when the rider actually opens that section.
4. **Cut startup data calls.** The content store hydrates events, feed,
   promos, sponsors and settings on mount, plus live subscriptions. Load only
   what the current page needs, and subscribe on demand.
5. **Measure before and after** on a phone-sized profile so the improvement is
   real, not assumed.

## Optional: crew gets its own icon, same app

If the goal is also "crew shouldn't see rider stuff", we can add a crew-only
installable entry point (`/crew` as the start screen, crew name and icon) so
staff phones get a separate app tile, while everything stays in one codebase
and one database.

## Proposed next step

Do the speed pass above (items 1–5), measure the difference, and only revisit
a true split if the numbers say the shared shell is the problem — which, from
the current structure, they will not.

## Technical notes

- Routes are already code-split per file by the TanStack Router plugin, so
  `admin.*` and `crew.*` chunks are not downloaded by riders. The shared cost
  is `__root.tsx` + `app-shell.tsx` and their eager imports, not route volume.
- Heaviest shared dependencies: `leaflet` + `leaflet-rotate` +
  `leaflet.markercluster`, `recharts`, `xlsx`. Confirm each is behind a
  `lazy()` boundary and never pulled into the root chunk.
- `useHydratedStore` opens one realtime channel with five table subscriptions
  at mount; scope this per route.
- No schema changes needed for any of this.
