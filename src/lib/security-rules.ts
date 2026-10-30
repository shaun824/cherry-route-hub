/** Encode untrusted text as a literal spreadsheet cell, never a formula. */
export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const unsafe = /^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text);
  return `"${(unsafe ? `'${text}` : text).replaceAll('"', '""')}"`;
}

export function canPublishTracking(event: { spectator_mode?: boolean | null; is_review_event?: boolean | null; is_public?: boolean | null } | null): boolean {
  return !!event && event.spectator_mode === true && event.is_review_event !== true && event.is_public !== false;
}

export function canReadResults(published: boolean, staff: boolean): boolean {
  return published || staff;
}

export function validFieldExpiry(exp: number, now = Date.now()): boolean {
  return Number.isSafeInteger(exp) && exp > now && exp <= now + 24 * 60 * 60_000;
}

export function privatePeerStats(values: number[]) {
  return values.length < 3 ? { best: null, average: null } : {
    best: Math.min(...values), average: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
  };
}