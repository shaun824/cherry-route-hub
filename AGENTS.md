<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Village section names use `VillageZone.showLabel` and default to visible when unset, preserving existing maps.
- Fullscreen rider/route/live navigation shares a Leaflet camera controller with gesture-paused follow and segment-based multi-section progress; normal map cameras are restored on exit, and the 120 m opening view is an approximate camera-height-equivalent scale, not terrain altitude.
- Map kilometre markers use full-resolution lines grouped by route and carry cumulative distance across sections without bridging gaps; run route-distance-markers tests whenever route or map distance logic changes to prevent reset labels and simplification drift.
- Crew live-map controls and selected-rider actions render outside the map; SOS resolution uses the signed-in race-control callback so field links remain read-only.
- Supplier promo ROI is an engagement estimate from outbound clicks, never a confirmed redemption or sale.
- PE Plett's Routes tab reuses generic route data but presents a PE Plett-only map-first journey and vector profile, keeping other events unchanged.
- Sea to Sea route maps use Leaflet panBy for unmodified trackpad wheel gestures and pointer-anchored setZoomAround for pinch; frame batching prevents gesture lag while preserving native touch dragging and other events' controls.

- In-event analytics go through `src/lib/event-analytics.ts` (batched `track()` queue, `data-section` / `data-track-action` markers) — one fire-and-forget path, no personal data in props.
- Rental plan edits regenerate an editable text plan from live rental data (not stored separately, since site_settings is publicly readable) and re-run it through the AI draft step before applying — keeps one source of truth.
- Sea to Sea pre-event guidance uses a dedicated registered email template so its fixed fuel, hotel, route-loading, and timetable instructions cannot drift through free-form workflow edits.
- Always name the event “JBFE Sea to Sea” in rider-facing copy; JBFE is the title sponsor.
- Village editor movement history stores position-only snapshots so undo never overwrites later text or styling edits.

- Apparel size rows on rider surfaces are driven by events.collects_tshirt_size/collects_jacket_size (src/lib/apparel.ts), never by event name — Entry Ninja syncs switch them on automatically so new events need no manual setup.
- Live-map rider position estimates are computed client-side for display only (src/lib/course-progress.ts estimateRider); tracking_points stores real GPS fixes only, and SOS/navigation always use the last real fix — keeps rescue data trustworthy.
- Strava tokens and segment efforts live in service-role-only tables, accessed only through server functions; other riders' personal segment times are never shown, only category fastest/average — keeps riders' Strava data private.
- On phones the document never scrolls: app-shell and admin layouts are one-screen flex frames scrolling inside #app-scroll (src/lib/app-scroll.ts), with bottom menus as in-flow last rows, never position:fixed — iOS 26 Safari strands fixed bars mid-screen when its toolbar collapses. Use scrollAppTo/getScrollTop instead of window.scroll*.
- Password recovery validates the link/session before enabling updates, displays the verified account email, rechecks identity on submit, and offers a fresh link on expired/missing sessions; never let a failed link update another signed-in account.
- Individual rider results reuse the event results source switch; missing roster bibs are inferred only from unambiguous full-name timing matches, without writing inferred identity back to entries.
- Automatic weekend podiums exclude riders whose explicit timed course differs from their entry class on any riding day, and expose mismatches in admin review; raw daily/GC timing remains unchanged because course corrections require timing-team confirmation.
- Results diagnostics use daily set labels before registration fields, preserve entry bike type on mixed Silver/Bronze daily lists, stay admin-only, and flag speed anomalies without disqualifying; this separates course evidence from suspicious timing.
- Event-day results alerts reuse the private-key hourly rooming callback and the fixed-recipient results-issues template with event/date/content idempotency; this avoids a separate scheduler or rider mailing list.
- Everlytic campaigns use an admin-only API boundary and a builder-confirmed installation host with redirects disabled; app sign-in and operational email delivery remain unchanged to protect credentials and avoid sender-domain conflicts.
- Otto1890 email artwork, partner logos and date/reminder blocks share one email-only module; the entries-open marketing creative is Everlytic-only and is never registered with the managed app-email sender, keeping promotional sends separate from confirmations.
- The public entry-alert bio page uses the existing entry-interest API and a bare one-screen scrolling layout, so visitors can subscribe without an account or rider navigation.
- Entry-alert audience sync verifies exact-email contacts and list mappings before adding missing memberships; never overwrite existing mappings or global contact status, so opt-outs and other lists remain unchanged.
