// Shared (client + server safe) loyalty helpers: tiers, settings shape, formatting.

export type LoyaltySettings = {
  demoMode: boolean;
  /** Points awarded for an event that has no explicit value set. */
  defaultPoints: number;
  /** Rand value of a single point when it is redeemed. */
  randPerPoint: number;
  /** Extra points for each consecutive year a rider comes back. */
  loyaltyBonusPerYear: number;
  /** Points earned per R1 of entry fee (0.1 = 1 point per R10 spent). */
  pointsPerRand: number;
  /**
   * Legacy earn multiplier for flagship events. Kept at 1: sell-out events
   * earn at the normal rate and are steered away from on redemption instead.
   */
  heroMultiplier: number;
  /** Rolling window (months) used to work out a rider's tier. */
  tierWindowMonths: number;
  /** Months a tier is held after a rider drops below its threshold. */
  tierHoldMonths: number;
  /** Months of inactivity before unredeemed points expire. */
  expiryMonths: number;
  programName: string;
};

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  demoMode: true,
  defaultPoints: 100,
  randPerPoint: 0.5,
  loyaltyBonusPerYear: 25,
  pointsPerRand: 0.1,
  heroMultiplier: 1,
  tierWindowMonths: 36,
  tierHoldMonths: 12,
  expiryMonths: 24,
  programName: "Cherry Miles",
};

export function parseLoyaltySettings(value: unknown): LoyaltySettings {
  const v = (value ?? {}) as Partial<LoyaltySettings>;
  return {
    demoMode: v.demoMode ?? DEFAULT_LOYALTY_SETTINGS.demoMode,
    defaultPoints: Number(v.defaultPoints ?? DEFAULT_LOYALTY_SETTINGS.defaultPoints),
    randPerPoint: Number(v.randPerPoint ?? DEFAULT_LOYALTY_SETTINGS.randPerPoint),
    loyaltyBonusPerYear: Number(v.loyaltyBonusPerYear ?? DEFAULT_LOYALTY_SETTINGS.loyaltyBonusPerYear),
    pointsPerRand: Number(v.pointsPerRand ?? DEFAULT_LOYALTY_SETTINGS.pointsPerRand),
    heroMultiplier: Number(v.heroMultiplier ?? DEFAULT_LOYALTY_SETTINGS.heroMultiplier),
    tierWindowMonths: Number(v.tierWindowMonths ?? DEFAULT_LOYALTY_SETTINGS.tierWindowMonths),
    tierHoldMonths: Number(v.tierHoldMonths ?? DEFAULT_LOYALTY_SETTINGS.tierHoldMonths),
    expiryMonths: Number(v.expiryMonths ?? DEFAULT_LOYALTY_SETTINGS.expiryMonths),
    programName: String(v.programName ?? DEFAULT_LOYALTY_SETTINGS.programName),
  };
}

/** Reward categories — merch/experience/partner cost us far less than entry discounts. */
export const REWARD_KINDS = [
  { key: "merch", label: "Merchandise", blurb: "Kit from the Red Cherry range" },
  { key: "experience", label: "Experience", blurb: "Perks on event weekend" },
  { key: "partner", label: "Partner offer", blurb: "Deals from our sponsors" },
  { key: "entry", label: "Entry discount", blurb: "Rand off a future entry" },
] as const;

export type RewardKind = (typeof REWARD_KINDS)[number]["key"];

export function rewardKindLabel(kind: string | null | undefined): string {
  return REWARD_KINDS.find((k) => k.key === kind)?.label ?? "Reward";
}


export type Tier = {
  key: string;
  name: string;
  min: number;
  perk: string;
  accent: string;
};

export const TIERS: Tier[] = [
  { key: "bronze", name: "Bronze", min: 0, perk: "Rider hub access + partner promos", accent: "#B87333" },
  { key: "silver", name: "Silver", min: 500, perk: "Early entry window on new events", accent: "#9AA5B1" },
  { key: "gold", name: "Gold", min: 1500, perk: "Priority tent placement + kit upgrades", accent: "#D4A017" },
  { key: "cherry", name: "Cherry Elite", min: 3500, perk: "VIP registration + guest pass", accent: "#D1122B" },
];

export function tierFor(points: number): { tier: Tier; next: Tier | null; toNext: number; progress: number } {
  let tier = TIERS[0] as Tier;
  for (const t of TIERS) if (points >= t.min) tier = t;
  const idx = TIERS.findIndex((t) => t.key === tier.key);
  const next = idx < TIERS.length - 1 ? (TIERS[idx + 1] as Tier) : null;
  const toNext = next ? Math.max(0, next.min - points) : 0;
  const span = next ? next.min - tier.min : 1;
  const progress = next ? Math.min(1, Math.max(0, (points - tier.min) / span)) : 1;
  return { tier, next, toNext, progress };
}

/**
 * Tier on a rolling window, with a status hold so a rider who skips a season
 * keeps the tier they earned for a while longer.
 */
export function tierForRolling(
  rollingPoints: number,
  heldPoints: number,
): { tier: Tier; next: Tier | null; toNext: number; progress: number; held: boolean } {
  const live = tierFor(rollingPoints);
  const hold = tierFor(Math.max(rollingPoints, heldPoints));
  const held = hold.tier.min > live.tier.min;
  return { ...live, tier: held ? hold.tier : live.tier, held };
}

/** Date cutoff N months back from now. */
export function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - Math.max(0, Math.round(months)));
  return d;
}

export function formatPoints(points: number): string {
  return new Intl.NumberFormat("en-ZA").format(Math.round(points));
}

export function randValue(points: number, randPerPoint: number): string {
  return `R${new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(points * randPerPoint)}`;
}

/**
 * Entry price (in cents) → loyalty points. Every event earns at the same rate;
 * sell-out events are handled on the redemption side, not by earning more.
 */
export function pointsFromPrice(
  entryPriceCents: number | null | undefined,
  _hero: boolean,
  settings: Pick<LoyaltySettings, "pointsPerRand" | "heroMultiplier" | "defaultPoints">,
): number {
  const rand = Number(entryPriceCents ?? 0) / 100;
  if (!Number.isFinite(rand) || rand <= 0) return settings.defaultPoints;
  const base = rand * settings.pointsPerRand;
  return Math.max(0, Math.round(base / 5) * 5);
}


export function formatRand(cents: number | null | undefined): string {
  const n = Number(cents ?? 0) / 100;
  return `R${new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(n)}`;
}
