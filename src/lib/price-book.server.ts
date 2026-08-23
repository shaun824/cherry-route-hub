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

/**
 * Prefill every entry on an event with what it costs.
 *
 * Entry Ninja's API carries no money values (only paid true/false), so the
 * per-event price book is the source of truth: we price each registration's
 * category + extras and store the result on event_entrants so riders (and the
 * group total) see real Rand amounts.
 */
export async function applyPriceBookToEntrants(
  admin: { from: (t: string) => any },
  eventId: string,
): Promise<{ priced: number; unpriced: number }> {
  const { priceEntry } = await import("./entry-pricing");

  const [{ data: prices }, { data: rows }] = await Promise.all([
    admin
      .from("event_price_book")
      .select("id, event_id, kind, label, price_cents, notes")
      .eq("event_id", eventId),
    admin
      .from("event_entrants")
      .select("id, category, extras, paid, amount_due_cents, amount_paid_cents")
      .eq("event_id", eventId),
  ]);

  const book = (prices ?? []) as any[];
  let priced = 0;
  let unpriced = 0;

  for (const r of (rows ?? []) as any[]) {
    const extras = Array.isArray(r.extras) ? (r.extras as { name?: string; qty?: number }[]) : [];
    const p = priceEntry(book as never, {
      category: r.category ?? null,
      extras: extras.filter((x) => x?.name).map((x) => ({ name: String(x.name), qty: Number(x.qty ?? 1) })),
    });
    if (!p.complete || p.totalCents == null) {
      unpriced++;
      continue;
    }
    const due = p.totalCents;
    const paidCents = r.paid === true ? due : r.paid === false ? 0 : (r.amount_paid_cents ?? null);
    if (r.amount_due_cents === due && r.amount_paid_cents === paidCents) {
      priced++;
      continue;
    }
    await admin
      .from("event_entrants")
      .update({ amount_due_cents: due, amount_paid_cents: paidCents })
      .eq("id", r.id);
    priced++;
  }

  return { priced, unpriced };
}
