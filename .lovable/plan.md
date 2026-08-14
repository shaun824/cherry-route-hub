# Rename "My Events" to "Adventure Awaits"

The tab lists both the events a rider has entered and every upcoming Red Cherry event, so the name changes to "Adventure Awaits" across the nav and the page headings.

## What changes

- **Bottom nav / sidebar tab**: "My Events" becomes "Adventure Awaits". Because the bottom bar has five tabs on a phone, the nav uses the short form **"Adventure"** with the full phrase kept for accessibility (screen readers and the desktop sidebar show "Adventure Awaits"), so the label never truncates mid-word.
- **Page heading** on the events tab: "Adventure Awaits", with subtitles kept as-is (e.g. "3 events on file", "Sign in to see your events").
- **Browser tab title**: "Adventure Awaits — Red Cherry Events".
- **Cross-references in copy** that point riders to the tab (home page button, sign-in help text, entry confirmation text, admin helper note) are reworded to say "Adventure Awaits".

## Not changing

- Routes and URLs stay `/my-events` and `/events` — no links break, no bookmarks die.
- No data, entry-linking, or event logic changes.

## Technical notes

Files touched: `src/components/app-shell.tsx` (nav item label + aria-label), `src/routes/my-events.tsx` (head title/meta), `src/routes/my-events.index.tsx` (three `PageHeader` titles), `src/routes/index.tsx` (CTA button), `src/routes/auth.tsx`, `src/routes/events.$eventId.enter.tsx`, `src/routes/admin.event-info.index.tsx` (copy references). Presentation-only edits.
