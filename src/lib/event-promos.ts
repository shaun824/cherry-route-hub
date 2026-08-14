import gm from "@/assets/sponsors/green-motion.png.asset.json";

export type EventPromo = {
  id: string;
  brand: string;
  title: string;
  blurb?: string;
  code: string;
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
  code: "REDCHERRY15",
  discount: "15%",
  url: "https://www.greenmotion.com/",
  logoUrl: gm.url,
  accent: "oklch(0.55 0.14 150)",
};

/** Which events show the Green Motion module (matched on event name). */
export function eventPromosFor(eventName: string | null | undefined): EventPromo[] {
  const n = (eventName ?? "").toLowerCase();
  const match =
    n.includes("addo") ||
    n.includes("tda") ||
    n.includes("weekend warrior") ||
    n.includes("weekend-warrior") ||
    n.includes("sea to sea") ||
    n.includes("sea2sea") ||
    n.includes("s2s") ||
    n.includes("plett");
  return match ? [GREEN_MOTION_PROMO] : [];
}
