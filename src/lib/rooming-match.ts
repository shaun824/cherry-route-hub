// Shared logic that links a rooming-list row to a rider's real event entry.
// Used by both the admin CSV/Excel import and the hourly Google Sheet sync, so
// both paths behave identically.

export type EntryCandidate = {
  /** event_entrants.id */
  id: string;
  entrant_id: string | null;
  full_name: string;
  email: string | null;
  registration_ref: string | null;
  external_id: string | null;
  bib_number: string | null;
  id_last4: string | null;
};

export type MatchSource = "ref" | "email" | "id" | "name" | "fuzzy" | "manual" | "none";

export type MatchInput = {
  full_name?: string | null;
  email?: string | null;
  /** optional reference column from the sheet */
  ref?: string | null;
  notes?: string | null;
};

export function normName(v: string | null | undefined): string {
  return (v ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normRef(v: string | null | undefined): string {
  return (v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function surname(v: string | null | undefined): string {
  const parts = normName(v).split(" ").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

/** "12345678901234" or free text → last four digits of an ID number, if present. */
export function idLast4(v: string | null | undefined): string | null {
  const digits = (v ?? "").replace(/\D+/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export type MatchResult = { entryId: string | null; entrantId: string | null; source: MatchSource };

const NO_MATCH: MatchResult = { entryId: null, entrantId: null, source: "none" };

function hit(c: EntryCandidate, source: MatchSource): MatchResult {
  return { entryId: c.id, entrantId: c.entrant_id, source };
}

/**
 * Finds the entry for one rooming row.
 * Order: registration reference → email → ID last 4 + surname → exact name → fuzzy name.
 */
export function matchEntry(row: MatchInput, candidates: EntryCandidate[]): MatchResult {
  if (candidates.length === 0) return NO_MATCH;

  const ref = normRef(row.ref);
  if (ref) {
    const byRef = candidates.find(
      (c) => normRef(c.registration_ref) === ref || normRef(c.external_id) === ref || normRef(c.bib_number) === ref,
    );
    if (byRef) return hit(byRef, "ref");
  }

  const email = (row.email ?? "").trim().toLowerCase();
  if (email) {
    const byEmail = candidates.find((c) => (c.email ?? "").toLowerCase() === email);
    if (byEmail) return hit(byEmail, "email");
  }

  const last4 = idLast4(row.ref) ?? idLast4(row.notes);
  if (last4) {
    const sn = surname(row.full_name);
    const byId = candidates.find(
      (c) => c.id_last4 === last4 && (!sn || surname(c.full_name) === sn),
    );
    if (byId) return hit(byId, "id");
  }

  const name = normName(row.full_name);
  if (name) {
    const exact = candidates.filter((c) => normName(c.full_name) === name);
    if (exact.length === 1) return hit(exact[0], "name");

    // Fuzzy: same surname + same first initial, and only one such person.
    const sn = surname(row.full_name);
    const initial = name.charAt(0);
    if (sn) {
      const near = candidates.filter(
        (c) => surname(c.full_name) === sn && normName(c.full_name).charAt(0) === initial,
      );
      if (near.length === 1) return hit(near[0], "fuzzy");
    }
  }

  return NO_MATCH;
}

type AnyClient = { from: (table: string) => any };

/** Every entry for an event, flattened into match candidates. */
export async function loadEntryCandidates(client: AnyClient, eventId: string): Promise<EntryCandidate[]> {
  const { data, error } = await client
    .from("event_entrants")
    .select(
      "id, entrant_id, bib_number, registration_ref, external_id, entrant:entrants(id, full_name, email, id_number_last4)",
    )
    .eq("event_id", eventId);
  if (error) {
    console.warn("[rooming-match] candidates", error);
    return [];
  }
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id as string,
    entrant_id: (r.entrant_id as string | null) ?? null,
    full_name: (r.entrant?.full_name as string | null) ?? "",
    email: (r.entrant?.email as string | null) ?? null,
    registration_ref: (r.registration_ref as string | null) ?? null,
    external_id: (r.external_id as string | null) ?? null,
    bib_number: (r.bib_number as string | null) ?? null,
    id_last4: (r.entrant?.id_number_last4 as string | null) ?? null,
  }));
}
