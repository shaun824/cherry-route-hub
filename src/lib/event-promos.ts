// Rider offers are admin-managed in Lovable Cloud (public.promos).
// Nothing here is hardcoded any more: the admin console is the single source
// of truth, and each promo carries the event keywords it should appear on.
import type { Promo } from "./mock-data";

export type EventPromo = {
  id: string;
  brand: string;
  title: string;
  blurb?: string;
  /** Discount code, when the offer uses one. */
  code?: string;
  /** How to redeem, when there is no code. */
  redeem?: string;
  discount: string;
  url: string;
  logoUrl: string;
  accent: string;
  estimatedClickValueCents: number;
};

/** Maps an admin-managed promo row onto the rider-facing card shape. */
export function toEventPromo(p: Promo): EventPromo {
  const expiryBlurb = undefined;
  return {
    id: p.id,
    brand: p.brand,
    title: p.title,
    blurb: p.blurb || expiryBlurb,
    code: p.code || undefined,
    redeem: p.code ? undefined : p.redeem || "Show this offer to the supplier",
    discount: p.discount,
    url: p.url || "#",
    logoUrl: p.logoUrl ?? "",
    accent: p.accent,
    estimatedClickValueCents: p.estimatedClickValueCents ?? 0,
  };
}

/** Blank keyword list = the offer runs on every event. */
export function promoMatchesEvent(p: Promo, eventName: string | null | undefined): boolean {
  const keywords = (p.eventMatch ?? "")
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (keywords.length === 0) return true;
  const n = (eventName ?? "").toLowerCase();
  return keywords.some((k) => n.includes(k));
}

/**
 * Business rule: a promo on an event never expires — it runs for as long as
 * the event does. Only the admin "Visible to riders" switch hides it.
 */
export function isPromoLive(p: Promo): boolean {
  return p.active !== false;
}

/** Offers to show for an event, from the admin-managed list. */
export function eventPromosFrom(
  promos: Promo[],
  eventName: string | null | undefined,
): EventPromo[] {
  return promos
    .filter((p) => isPromoLive(p) && promoMatchesEvent(p, eventName))
    .map(toEventPromo);
}

/**
 * Random order so every page load leads with a different sponsor offer —
 * this keeps promo-code usage spread evenly across partners.
 */
export function shufflePromos(promos: EventPromo[]): EventPromo[] {
  const out = [...promos];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
