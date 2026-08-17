import gm from "@/assets/sponsors/green-motion.png.asset.json";
import rudy from "@/assets/sponsors/rudy-project.png.asset.json";
import cycleLab from "@/assets/sponsors/cycle-lab.png.asset.json";
import westvaal from "@/assets/sponsors/westvaal.png.asset.json";

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
};

/** Green Motion car & van rental rider discount. */
export const GREEN_MOTION_PROMO: EventPromo = {
  id: "green-motion-15",
  brand: "Green Motion Car & Van Rental",
  title: "15% off your car or van rental",
  blurb:
    "Getting to the event? Riders get 15% off Green Motion rentals — quote the code when you book.",
  code: "RCE15",
  discount: "15%",
  url: "https://greenmotion.com/",
  logoUrl: gm.url,
  accent: "oklch(0.55 0.14 150)",
};

const RUDY_PROMO: EventPromo = {
  id: "rudy-750",
  brand: "Rudy Project",
  title: "R750 off in store at the event",
  blurb:
    "Redeemable at the event only — visit the Rudy Project stand in the village to claim your R750 off.",
  redeem: "Claim in store at the Rudy Project stand — event only",
  discount: "R750",
  url: "https://www.rudyprojectsa.co.za/",
  logoUrl: rudy.url,
  accent: "oklch(0.5 0.16 25)",
};

const CYCLE_LAB_PROMO: EventPromo = {
  id: "cycle-lab-150",
  brand: "Cycle Lab",
  title: "R150 off in store at the event",
  blurb:
    "Redeemable at the event only — claim R150 off in store at the Cycle Lab stand, linked to your cell phone number.",
  redeem: "Claim in store at the Cycle Lab stand with your cell number",
  discount: "R150",
  url: "https://www.cyclelab.com/",
  logoUrl: cycleLab.url,
  accent: "oklch(0.45 0.12 250)",
};

const WESTVAAL_PROMO: EventPromo = {
  id: "westvaal-test-drive",
  brand: "Westvaal Somerset West",
  title: "Free 2027 Weekend Warrior Grabouw entry",
  blurb:
    "Book and complete a test drive with Westvaal Somerset West before the end of November 2026 and get a free entry to Weekend Warrior Grabouw 2027.",
  redeem: "Book a test drive before 30 November 2026",
  discount: "Free entry",
  url: "https://www.westvaal.co.za/",
  logoUrl: westvaal.url,
  accent: "oklch(0.42 0.14 265)",
};

/** Which events show which promo modules (matched on event name). */
export function eventPromosFor(eventName: string | null | undefined): EventPromo[] {
  const n = (eventName ?? "").toLowerCase();
  if (n.includes("weekend warrior") || n.includes("weekend-warrior")) {
    return [GREEN_MOTION_PROMO, RUDY_PROMO, CYCLE_LAB_PROMO, WESTVAAL_PROMO];
  }
  const match =
    n.includes("addo") ||
    n.includes("tda") ||
    n.includes("sea to sea") ||
    n.includes("sea2sea") ||
    n.includes("s2s") ||
    n.includes("plett");
  return match ? [GREEN_MOTION_PROMO] : [];
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
