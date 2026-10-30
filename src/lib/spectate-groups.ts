// Groups events for the "Track riders" list: everything that has already
// finished this year, and everything still to come.
import { eventEndMs } from "./event-window";
import type { Event } from "./mock-data";

export type SpectateGroups = {
  /** Finished events from the current calendar year, most recent first. */
  past: Event[];
  /** Live and future events, soonest first. */
  upcoming: Event[];
};

/**
 * Past events from earlier years are left out entirely: the list shows this
 * year's history, not the whole archive. Draft and private review events never
 * appear. Completed events are normally archived, so archived rows still count
 * as past.
 */
export function groupSpectateEvents(
  events: Event[],
  now: number = Date.now(),
): SpectateGroups {
  const year = new Date(now).getFullYear();
  const past: Event[] = [];
  const upcoming: Event[] = [];

  for (const e of events) {
    if (e.isReviewEvent) continue;
    const lifecycle = e.lifecycle ?? "published";
    if (lifecycle === "draft") continue;

    const end = eventEndMs(e);
    if (end < now) {
      if (new Date(end).getFullYear() === year) past.push(e);
      continue;
    }
    // Not finished yet: only unpublished/retired events stay off the list.
    if (lifecycle === "archived") continue;
    upcoming.push(e);
  }

  past.sort((a, b) => eventEndMs(b) - eventEndMs(a));
  upcoming.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  return { past, upcoming };
}
