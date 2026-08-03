# Home page: event discovery by sport, news moves per event

## Goal

Make the home page a live, always-changing view of what's coming up, split into Motorbike and Bicycle events. Retire the general news section from home and move news to a per-event tab, so riders read updates in the context of the event they entered.

## New home page structure (top to bottom)

1. Hero header — brand, welcome, notifications bell (unchanged)
2. Your next event — countdown hero for signed-in riders with a linked entry (unchanged, stays on top). Signed-out riders keep the sign-in CTA card.
3. Pinned notice strip — a single slim alert row, only when a pinned post exists that isn't tied to a specific event. Tappable to expand; nothing shows when there's no pinned notice.
4. Motorbike events — section with the moto icon, showing the next 4 upcoming motorbike events, each card with date, countdown ("In 12d"), location, distance and status badge. "See all" link to the events list filtered to moto.
5. Bicycle events — same layout for MTB/gravel/road events, "See all" to the events list filtered to bike.
6. Supplier promos (unchanged)
7. Sponsor scroller (unchanged)

Removed from home: the "Latest from the pits" news list. General news is still reachable from the notifications bell and the existing feed page.

Event cards sort by soonest date, exclude archived/past events, and show a live pulse badge when an event is running. Sections hide themselves if that sport has no upcoming events.

## Per-event news tab

The event page (My Events > event) gains a "News" tab alongside Info, Packing, Chat and Ask. It lists posts assigned to that event, pinned first, newest first, with type badge and relative time — same visual treatment as today's feed cards. A badge dot appears on the tab when there are posts from the last 7 days.

Empty state: "No updates for this event yet."

## Events list filtering

The events page gets Motorbike / Bicycle / All filter pills so the "See all" links from home land on the right list.

## Technical notes

- Sport classification reuses `src/lib/event-sport.ts` (`getEventSport`), already used on the events list.
- Home reads events from the existing `useAdminStore` + `useHydratedStore` hydration; no schema changes needed.
- Per-event news filters `feed` on the existing `eventId` field on `FeedPost`; the admin feed editor already supports assigning a post to an event.
- Home page `head()` description updated to reflect event discovery instead of news.
- New home sections extracted into small components inside `src/routes/index.tsx` to keep the file readable.

Files touched: `src/routes/index.tsx`, `src/routes/my-events.$eventId.tsx`, `src/routes/events.index.tsx`.
