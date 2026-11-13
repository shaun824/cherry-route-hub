// Shared helpers for event interest sign-ups (people who opt in on an event
// website before entries open, e.g. the Inner City Enduro contact form).

import { ICE_EVENT_ID } from "./ice-interest";

/** ICE has its own branded confirmation; all other events use the shared template. */
export function eventInterestTemplate(eventId: string) {
  return eventId === ICE_EVENT_ID ? "ice-signup-confirmation" : "event-interest-confirmation";
}

export function normaliseEmail(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}

/** New explicit consent renews this event opt-in, not global provider opt-outs. */
export function renewedInterestConsent(now: string) {
  return { consent: true as const, consent_at: now, updated_at: now, unsubscribed_at: null };
}

export function interestConfirmationKey(signupId: string, priorUnsubscribe: string | null) {
  return `event-interest-confirm-${signupId}${priorUnsubscribe ? `-rejoin-${priorUnsubscribe}` : ""}`;
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
