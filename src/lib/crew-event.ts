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
 * Returns the crew's chosen event id, defaulting to the saved one (or the next
 * upcoming event) once the list loads. Setting it persists for every crew tool.
 */
export function useCrewEvent(events: EventLike[]): [string, (id: string) => void] {
  const [eventId, setEventId] = useState("");

  useEffect(() => {
    if (eventId || !events.length) return;
    const saved = readCrewEventId();
    if (saved && events.some((e) => e.id === saved)) {
      setEventId(saved);
      return;
    }
    const now = Date.now();
    const next =
      events.find((e) => (e.event_date ? new Date(e.event_date).getTime() >= now : false)) ??
      events[events.length - 1];
    if (next) setEventId(next.id);
  }, [events, eventId]);

  const pick = useCallback((id: string) => {
    setEventId(id);
    if (id) writeCrewEventId(id);
  }, []);

  return [eventId, pick];
}
