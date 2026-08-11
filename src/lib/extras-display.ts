import type { ExtraItem } from "@/lib/my-events";

export type ExtraGroupKey = "merch" | "accommodation" | "apparel" | "other";

export type DisplayExtra = {
  name: string;
  option: string | null;
  qty: number;
};

export type ExtraGroup = {
  key: ExtraGroupKey;
  label: string;
  items: DisplayExtra[];
};

const GROUP_LABELS: Record<ExtraGroupKey, string> = {
  merch: "Merchandise & add-ons",
  accommodation: "Accommodation",
  apparel: "Apparel",
  other: "Other details",
};

const GROUP_ORDER: ExtraGroupKey[] = ["merch", "accommodation", "apparel", "other"];

const APPAREL_RE = /\b(t[\s-]?shirt|shirt|riding top|jacket|jersey|vest|cap|sock|apparel|size)\b/i;
const ACCOM_RE =
  /\b(accommodation|hotel|lodge|chalet|tent|camp|camping|room|bed|sleep|housed|guest ?house|no hassles?)\b/i;
const OTHER_RE =
  /\b(licen[cs]e|dietary|diet|allerg|medical|emergency|indemnity|waiver|newsletter|prefer|question)\b/i;
const MERCH_RE =
  /\b(wash|rental|rent|hire|e[\s-]?bike|bike service|service|transfer|transport|shuttle|massage|meal|breakfast|dinner|lunch|beer|merch|bag|luggage|package|photo|entry pack)\b/i;

/** Strip "Yes I want the ..." style answers down to something readable. */
export function tidyOption(name: string, raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  // Pure affirmative answers add nothing beyond "this is included".
  if (/^(yes|y|true|selected|confirmed)$/i.test(value)) return "Included";
  if (/^(no|n|false|none|not required)$/i.test(value)) return null;
  if (/^yes[,!\s]/i.test(value) || /^yes\b.*\b(want|need|please|take|include)\b/i.test(value)) {
    return "Included";
  }
  if (/^i (want|need)\b/i.test(value)) return "Included";

  // Option that just repeats the item name.
  if (value.toLowerCase() === name.trim().toLowerCase()) return null;

  return value;
}

function classify(name: string): ExtraGroupKey {
  if (APPAREL_RE.test(name)) return "apparel";
  if (ACCOM_RE.test(name)) return "accommodation";
  if (MERCH_RE.test(name)) return "merch";
  if (OTHER_RE.test(name)) return "other";
  return "merch";
}

export function groupExtras(extras: ExtraItem[] | null | undefined): ExtraGroup[] {
  const buckets = new Map<ExtraGroupKey, DisplayExtra[]>();
  for (const x of extras ?? []) {
    const name = (x.name ?? "").toString().trim();
    if (!name) continue;
    const key = classify(name);
    const list = buckets.get(key) ?? [];
    list.push({ name, option: tidyOption(name, x.size), qty: x.qty ?? 1 });
    buckets.set(key, list);
  }
  return GROUP_ORDER.filter((k) => (buckets.get(k)?.length ?? 0) > 0).map((k) => ({
    key: k,
    label: GROUP_LABELS[k],
    items: buckets.get(k)!,
  }));
}

/** Flat, tidied list preserving group order — used by the printable report. */
export function flattenExtras(extras: ExtraItem[] | null | undefined) {
  return groupExtras(extras).flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));
}
