/**
 * Entry Ninja registration links use only the numeric registration id.
 * Synced refs look like "E83973-14098536" — the "E83973-" event prefix must be
 * stripped so the link resolves to the rider's entry.
 */
export function entryNinjaRegistrationId(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const trimmed = String(ref).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/(\d+)\s*$/);
  return match ? match[1] : trimmed;
}

export function entryNinjaRegistrationUrl(ref: string | null | undefined): string | null {
  const id = entryNinjaRegistrationId(ref);
  return id ? `https://entries.redcherryevents.co.za/registrations/${id}` : null;
}
