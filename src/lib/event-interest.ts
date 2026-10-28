// Shared helpers for event interest sign-ups (people who opt in on an event
// website before entries open, e.g. the Inner City Enduro contact form).

export function normaliseEmail(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}

export interface AudiencePerson {
  email: string;
  name: string | null;
  /** When set, this person came from the interest list and gets an unsubscribe link. */
  interestId?: string | null;
}

/**
 * Merges entrant and interest-sign-up audiences into one list, deduped by
 * email. Entrants win when an address appears in both, so their personalisation
 * (entry date, registration ref) is kept.
 */
export function mergeAudiences(
  entrants: AudiencePerson[],
  interest: AudiencePerson[],
  audience: "entrants" | "interest" | "both",
): AudiencePerson[] {
  const byEmail = new Map<string, AudiencePerson>();
  if (audience !== "interest") {
    for (const p of entrants) {
      const email = normaliseEmail(p.email);
      if (email && !byEmail.has(email)) byEmail.set(email, { ...p, email });
    }
  }
  if (audience !== "entrants") {
    for (const p of interest) {
      const email = normaliseEmail(p.email);
      if (email && !byEmail.has(email)) byEmail.set(email, { ...p, email });
    }
  }
  return Array.from(byEmail.values());
}
