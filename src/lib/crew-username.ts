// Crew members on site often don't have an email address, so they sign in with
// a username instead. A username maps deterministically to a hidden internal
// email address that the auth system uses behind the scenes.
export const CREW_EMAIL_DOMAIN = "crew.redcherryevents.co.za";

/** Lowercase, email-safe form of a crew username. */
export function normaliseCrewUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "")
    .slice(0, 40);
}

export function isEmailAddress(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

/** The internal login address for a crew username. */
export function crewEmailForUsername(username: string): string {
  return `${normaliseCrewUsername(username)}@${CREW_EMAIL_DOMAIN}`;
}

/** Turn whatever the user typed into the address we hand to the auth system. */
export function loginIdentifierToEmail(input: string): string {
  const value = input.trim();
  return isEmailAddress(value) ? value.toLowerCase() : crewEmailForUsername(value);
}

/** Display the username back from an internal crew address. */
export function usernameFromCrewEmail(email: string): string {
  return email.toLowerCase().endsWith(`@${CREW_EMAIL_DOMAIN}`) ? email.split("@")[0] : email;
}

export function isCrewEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${CREW_EMAIL_DOMAIN}`);
}
