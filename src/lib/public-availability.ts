// Count-only availability for marketing sites. No personal data ever leaves here.
export type AvailabilityClass = {
  id: string;
  label: string;
  capacity: number | null;
  sold: number;
  remaining: number | null;
};
export type Availability = {
  event: string;
  updated_at: string;
  capacity: number | null;
  sold: number;
  remaining: number | null;
  classes: AvailabilityClass[];
};

const norm = (s: string) => s.trim().replace(/[.\s]+$/, "").toLowerCase();
const cap = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
const left = (c: number | null, sold: number) => (c == null ? null : Math.max(c - sold, 0));

/** categories: one entry per event_entrants row (its class name). */
export function buildAvailability(
  slug: string,
  eventCapacity: unknown,
  classes: { id?: string; label?: string; capacity?: unknown }[],
  categories: (string | null)[],
  now = new Date(),
): Availability {
  const counts = new Map<string, number>();
  for (const c of categories) {
    if (!c) continue;
    const k = norm(c);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const list = classes.map((c) => {
    const sold = counts.get(norm(c.label ?? "")) ?? 0;
    const capacity = cap(c.capacity);
    return { id: String(c.id ?? ""), label: String(c.label ?? ""), capacity, sold, remaining: left(capacity, sold) };
  });
  const sold = categories.length;
  const capacity = cap(eventCapacity);
  return { event: slug, updated_at: now.toISOString(), capacity, sold, remaining: left(capacity, sold), classes: list };
}
