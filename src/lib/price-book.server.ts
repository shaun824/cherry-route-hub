// Helpers for the event price book (kept out of the .functions file so the
// server-function splitter can't strip them).
import { priceKey } from "./entry-pricing";

export type PriceBookLabelRow = {
  kind: "category" | "extra";
  label: string;
  count: number;
  priceCents: number | null;
};

/**
 * Work out every category and extra actually used on an event's roster, and
 * attach any price already saved for it.
 */
export function collectPriceLabels(
  entrants: { category: string | null; extras: unknown }[],
  prices: { kind: string; label: string; price_cents: number }[],
): PriceBookLabelRow[] {
  const saved = new Map<string, number>();
  for (const p of prices) saved.set(`${p.kind}|${priceKey(p.label)}`, p.price_cents);

  const counts = new Map<string, { kind: "category" | "extra"; label: string; count: number }>();
  const bump = (kind: "category" | "extra", raw: string | null | undefined) => {
    const label = (raw ?? "").trim();
    if (!label) return;
    const key = `${kind}|${priceKey(label)}`;
    const hit = counts.get(key);
    if (hit) hit.count += 1;
    else counts.set(key, { kind, label, count: 1 });
  };

  for (const e of entrants) {
    bump("category", e.category);
    const extras = Array.isArray(e.extras) ? e.extras : [];
    for (const x of extras as { name?: string }[]) bump("extra", x?.name);
  }

  // Prices saved for labels no longer on the roster still show, so admins can clear them.
  for (const p of prices) {
    const kind = p.kind === "extra" ? "extra" : "category";
    const key = `${kind}|${priceKey(p.label)}`;
    if (!counts.has(key)) counts.set(key, { kind, label: p.label, count: 0 });
  }

  return [...counts.entries()]
    .map(([key, v]) => ({ ...v, priceCents: saved.get(key) ?? null }))
    .sort((a, b) => (a.kind === b.kind ? b.count - a.count : a.kind === "category" ? -1 : 1));
}
