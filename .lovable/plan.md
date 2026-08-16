# Rename "Your other events" on the home page

## Change

The small heading above the horizontal card strip of the rider's additional entries changes from "Your other events" to "More adventures ahead" — warmer, and consistent with the "Adventure Awaits" naming used elsewhere.

Nothing else changes: same cards, same order, same links.

## Technical note

- `src/routes/index.tsx` (~line 810): update the heading text inside the `rest.length > 0` block. Text-only edit, no logic or data changes.
