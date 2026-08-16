import { useEffect, useState } from "react";

import { shufflePromos, type EventPromo } from "@/lib/event-promos";

const LAST_KEY = "rce.promo.lastLead";

/**
 * Shuffles the offers on every visit and — where there is more than one —
 * guarantees the lead offer is NOT the one this browser saw last time, so
 * promo-code exposure spreads evenly across partners.
 *
 * Shuffling happens after hydration so server and client markup match.
 */
export function useShuffledPromos(promos: EventPromo[]): EventPromo[] {
  const ids = promos.map((p) => p.id).join("|");
  const [ordered, setOrdered] = useState<EventPromo[]>(promos);

  useEffect(() => {
    if (promos.length < 2) {
      setOrdered(promos);
      return;
    }
    let last: string | null = null;
    try {
      last = window.localStorage.getItem(LAST_KEY);
    } catch {
      last = null;
    }

    let next = shufflePromos(promos);
    for (let attempt = 0; attempt < 6 && next[0]?.id === last; attempt++) {
      next = shufflePromos(promos);
    }
    try {
      if (next[0]) window.localStorage.setItem(LAST_KEY, next[0].id);
    } catch {
      /* private mode — ordering still shuffles, just without memory */
    }
    setOrdered(next);
    // Re-shuffle whenever the set of offers changes (per event / per page).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  return ordered;
}
