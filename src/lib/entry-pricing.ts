// Works out what a rider still owes.
//
// Entry Ninja's API only tells us paid: true/false — it never returns money
// values. So admins keep a per-event price book (entry categories + extras)
// and we price each entry from it.
import { supabase } from "@/integrations/supabase/client";

export type PriceRow = {
  id: string;
  event_id: string;
  kind: "category" | "extra";
  label: string;
  price_cents: number;
  notes: string | null;
};

export type PricedLine = { label: string; qty: number; unitCents: number; totalCents: number };

export type EntryPricing = {
  /** Total value of the entry, or null when we can't price it. */
  totalCents: number | null;
  lines: PricedLine[];
  /** Labels we had no price for — these make the total a partial figure. */
  missing: string[];
  complete: boolean;
};

export function priceKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Build a lookup that also tolerates minor wording drift (e.g. trailing notes). */
function lookup(rows: PriceRow[], kind: PriceRow["kind"]) {
  const exact = new Map<string, number>();
  for (const r of rows) {
    if (r.kind !== kind) continue;
    exact.set(priceKey(r.label), r.price_cents);
  }
  return (label: string): number | null => {
    const k = priceKey(label);
    if (!k) return null;
    const hit = exact.get(k);
    if (hit != null) return hit;
    for (const [key, cents] of exact) {
      if (key.length >= 4 && (k.startsWith(key) || key.startsWith(k))) return cents;
    }
    return null;
  };
}

export function priceEntry(
  rows: PriceRow[],
  entry: { category: string | null; extras?: { name: string; qty?: number }[] | null },
): EntryPricing {
  const lines: PricedLine[] = [];
  const missing: string[] = [];

  const categoryPrice = lookup(rows, "category");
  const extraPrice = lookup(rows, "extra");

  if (entry.category) {
    const cents = categoryPrice(entry.category);
    if (cents == null) missing.push(entry.category);
    else lines.push({ label: entry.category, qty: 1, unitCents: cents, totalCents: cents });
  }

  for (const x of entry.extras ?? []) {
    if (!x?.name) continue;
    const qty = Math.max(1, Number(x.qty ?? 1) || 1);
    const cents = extraPrice(x.name);
    if (cents == null) {
      missing.push(x.name);
      continue;
    }
    if (cents === 0) continue; // priced as included / free
    lines.push({ label: x.name, qty, unitCents: cents, totalCents: cents * qty });
  }

  const totalCents = lines.length ? lines.reduce((s, l) => s + l.totalCents, 0) : null;
  return { totalCents, lines, missing, complete: missing.length === 0 && totalCents != null };
}

export async function fetchPriceBook(eventId: string): Promise<PriceRow[]> {
  const { data, error } = await supabase
    .from("event_price_book")
    .select("id, event_id, kind, label, price_cents, notes")
    .eq("event_id", eventId)
    .order("kind")
    .order("label");
  if (error) {
    console.warn("[price-book]", error);
    return [];
  }
  return (data ?? []) as PriceRow[];
}
