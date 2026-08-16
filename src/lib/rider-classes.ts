/**
 * Class grouping for Weekend Warrior style events.
 *
 * Riders are grouped into the real race classes (Bronze / Silver / Gold,
 * Under 14 vs Adult, plus the E-Bike equivalents) and split by gender when the
 * data has it. Day-pass entries are kept out of the main list and grouped by
 * their distance at the bottom. Empty classes are never returned.
 */

export type ClassRow = {
  category?: string | null;
  batch?: string | null;
  gender?: string | null;
};

export type ClassGroup<T> = {
  key: string;
  label: string;
  rows: T[];
};

export type ClassGrouping<T> = {
  /** Main event classes, ordered Bronze → Silver → Gold, U/14 before Adult, bikes before e-bikes. */
  classes: ClassGroup<T>[];
  /** Day-pass riders grouped by distance. */
  dayRiders: ClassGroup<T>[];
};

const TIERS = ["bronze", "silver", "gold"] as const;
type Tier = (typeof TIERS)[number];

function tierOf(cat: string): Tier | null {
  for (const t of TIERS) if (cat.includes(t)) return t;
  return null;
}

function genderOf(raw: string | null | undefined): "male" | "female" | null {
  const g = (raw ?? "").trim().toLowerCase();
  if (!g) return null;
  if (g.startsWith("m")) return "male";
  if (g.startsWith("f") || g.startsWith("w")) return "female";
  return null;
}

export function isDayPass(category: string | null | undefined) {
  const c = (category ?? "").toLowerCase();
  return c.includes("day pass") || c.includes("day rider") || c.includes("day entry");
}

function titleCase(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function groupRidersByClass<T extends ClassRow>(rows: T[]): ClassGrouping<T> {
  const buckets = new Map<string, { label: string; order: number; rows: T[] }>();
  const day = new Map<string, { label: string; rows: T[] }>();

  for (const r of rows) {
    const cat = (r.category ?? "").toLowerCase();

    if (isDayPass(r.category)) {
      const label = (r.batch || "Day riders").trim();
      if (!day.has(label)) day.set(label, { label, rows: [] });
      day.get(label)!.rows.push(r);
      continue;
    }

    const tier = tierOf(cat);
    if (!tier) {
      const label = (r.category || "Other entries").trim();
      const key = `zz:${label}`;
      if (!buckets.has(key)) buckets.set(key, { label, order: 9000, rows: [] });
      buckets.get(key)!.rows.push(r);
      continue;
    }

    const ebike = /e-?\s?bike/.test(cat);
    const u14 = /u\s*\/?\s*14|under\s*14|junior/.test(cat);
    const gender = genderOf(r.gender);

    const key = `${ebike ? "e" : "a"}:${tier}:${u14 ? "u14" : "adult"}:${gender ?? "open"}`;
    const label = [
      ebike ? "E-Bike" : null,
      titleCase(tier),
      "·",
      u14 ? "Under 14" : "Adult",
      gender ? (gender === "male" ? "· Men" : "· Women") : null,
    ]
      .filter(Boolean)
      .join(" ");

    const order =
      (ebike ? 100 : 0) + TIERS.indexOf(tier) * 10 + (u14 ? 0 : 1) * 2 + (gender === "female" ? 1 : 0);

    if (!buckets.has(key)) buckets.set(key, { label, order, rows: [] });
    buckets.get(key)!.rows.push(r);
  }

  const classes = Array.from(buckets.entries())
    .filter(([, g]) => g.rows.length > 0)
    .sort((a, b) => a[1].order - b[1].order || a[1].label.localeCompare(b[1].label))
    .map(([key, g]) => ({ key, label: g.label, rows: g.rows }));

  const distanceOf = (label: string) => {
    const n = Number(label.replace(/[^\d]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : Number.MAX_SAFE_INTEGER;
  };

  const dayRiders = Array.from(day.entries())
    .filter(([, g]) => g.rows.length > 0)
    .sort((a, b) => distanceOf(a[1].label) - distanceOf(b[1].label) || a[1].label.localeCompare(b[1].label))
    .map(([key, g]) => ({ key: `day:${key}`, label: g.label, rows: g.rows }));

  return { classes, dayRiders };
}
