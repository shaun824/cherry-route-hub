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
- Supplier promo ROI is an engagement estimate from outbound clicks, never a confirmed redemption or sale.
- PE Plett's Routes tab reuses generic route data but presents a PE Plett-only map-first journey and vector profile, keeping other events unchanged.

- In-event analytics go through `src/lib/event-analytics.ts` (batched `track()` queue, `data-section` / `data-track-action` markers) — one fire-and-forget path, no personal data in props.
- Rental plan edits regenerate an editable text plan from live rental data (not stored separately, since site_settings is publicly readable) and re-run it through the AI draft step before applying — keeps one source of truth.
- Sea to Sea pre-event guidance uses a dedicated registered email template so its fixed fuel, hotel, route-loading, and timetable instructions cannot drift through free-form workflow edits.
- Always name the event “JBFE Sea to Sea” in rider-facing copy; JBFE is the title sponsor.
- Village editor movement history stores position-only snapshots so undo never overwrites later text or styling edits.
