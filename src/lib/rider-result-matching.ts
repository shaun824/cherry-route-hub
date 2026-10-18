import type { ResultRow, TrackedRider } from "./results.functions";

const normalise = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
const validBib = (value: string | null | undefined) => {
  const bib = normalise(value);
  return bib && !/^(tbc|n\/a|0|-)$/.test(bib) ? bib : null;
};

/** Prefer a known bib; only infer a missing bib from an unambiguous full name. */
export function resultsForRider(rider: Pick<TrackedRider, "full_name" | "bib_number">, rows: ResultRow[]) {
  const bib = validBib(rider.bib_number);
  if (bib) {
    const byBib = rows.filter((row) => validBib(row.bib_number) === bib);
    if (byBib.length) return byBib;
  }
  const name = normalise(rider.full_name);
  if (!name) return [];
  const byName = rows.filter((row) => normalise(row.full_name) === name);
  const bibs = new Set(byName.map((row) => validBib(row.bib_number)).filter(Boolean));
  return bibs.size > 1 ? [] : byName;
}

export function timingBibForRider(rider: Pick<TrackedRider, "full_name" | "bib_number">, rows: ResultRow[]) {
  if (validBib(rider.bib_number)) return rider.bib_number;
  return resultsForRider(rider, rows).find((row) => validBib(row.bib_number))?.bib_number ?? null;
}