import { useEffect } from "react";

import type { EventPromo } from "@/lib/event-promos";
import { getSessionId, track } from "@/lib/analytics";

function propsFor(promo: EventPromo) {
  return {
    promo_id: promo.id,
    brand: promo.brand,
    has_code: Boolean(promo.code),
    has_url: Boolean(promo.url && promo.url !== "#"),
  };
}

export function trackPromoAction(
  promo: EventPromo,
  action: "promo_open" | "promo_copy" | "promo_outbound",
) {
  void track({ eventName: action, props: propsFor(promo) });
}

/** Count an offer once per browser session, even when it appears in several places. */
export function usePromoImpression(promo: EventPromo) {
  useEffect(() => {
    const key = `rce_promo_seen:${getSessionId()}:${promo.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage can be unavailable; recording the impression is still safe.
    }
    void track({ eventName: "promo_impression", props: propsFor(promo) });
  }, [promo.id, promo.brand, promo.code, promo.url]);
}