// Shared (client + server safe) loyalty helpers: tiers, settings shape, formatting.

export type LoyaltySettings = {
  demoMode: boolean;
  /** Points awarded for an event that has no explicit value set. */
  defaultPoints: number;
  /** Rand value of a single point — used for admin liability maths only. */
  randPerPoint: number;
  /** Extra points for each consecutive year a rider comes back. */
  loyaltyBonusPerYear: number;
  programName: string;
};

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  demoMode: true,
  defaultPoints: 100,
  randPerPoint: 0.2,
  loyaltyBonusPerYear: 25,
  programName: "Cherry Miles",
};

export function parseLoyaltySettings(value: unknown): LoyaltySettings {
  const v = (value ?? {}) as Partial<LoyaltySettings>;
  return {
    demoMode: v.demoMode ?? DEFAULT_LOYALTY_SETTINGS.demoMode,
    defaultPoints: Number(v.defaultPoints ?? DEFAULT_LOYALTY_SETTINGS.defaultPoints),
    randPerPoint: Number(v.randPerPoint ?? DEFAULT_LOYALTY_SETTINGS.randPerPoint),
    loyaltyBonusPerYear: Number(v.loyaltyBonusPerYear ?? DEFAULT_LOYALTY_SETTINGS.loyaltyBonusPerYear),
    programName: String(v.programName ?? DEFAULT_LOYALTY_SETTINGS.programName),
  };
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

export function formatPoints(points: number): string {
  return new Intl.NumberFormat("en-ZA").format(Math.round(points));
}

export function randValue(points: number, randPerPoint: number): string {
  return `R${new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 }).format(points * randPerPoint)}`;
}
