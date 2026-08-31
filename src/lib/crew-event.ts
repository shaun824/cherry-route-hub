// One shared "event you're working" choice for every crew tool. Pick it once on
// the crew dashboard and every other crew page opens on that same event.
import { useCallback, useEffect, useState } from "react";

export const CREW_EVENT_KEY = "rce:crew-event";

export function readCrewEventId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CREW_EVENT_KEY);
}

export function writeCrewEventId(id: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(CREW_EVENT_KEY, id);
}

type EventLike = { id: string; event_date?: string | null };

/**
 * Returns the crew's chosen event id. The default is always the next upcoming
 * event (today counts); past events stay in the list for manual selection.
 * A manual pick persists for every crew tool until the list reloads.
 */
export function useCrewEvent(events: EventLike[]): [string, (id: string) => void] {
  const [eventId, setEventId] = useState("");

  useEffect(() => {
    if (eventId || !events.length) return;
    // Next upcoming event: compare at day granularity so today's event wins.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = events.find((e) => {
      if (!e.event_date) return false;
      const d = new Date(e.event_date);
      d.setHours(0, 0, 0, 0);
      return d.getTime() >= today.getTime();
    });
    if (next) {
      setEventId(next.id);
      return;
    }
    const saved = readCrewEventId();
    if (saved && events.some((e) => e.id === saved)) {
      setEventId(saved);
      return;
    }
    const last = events[events.length - 1];
    if (last) setEventId(last.id);
  }, [events, eventId]);

  const pick = useCallback((id: string) => {
    setEventId(id);
    if (id) writeCrewEventId(id);
  }, []);

  return [eventId, pick];
}
