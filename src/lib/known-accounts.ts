/**
 * Remembers which accounts have signed in on this device so riders can switch
 * quickly between them (e.g. their own account and a partner's).
 *
 * Only the email + display name are stored — never passwords or tokens.
 */
const KEY = "rce:known-accounts";
const MAX = 6;

export type KnownAccount = {
  email: string;
  name?: string | null;
  lastUsed: number;
};

export function listKnownAccounts(): KnownAccount[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as KnownAccount[])
      .filter((a) => a && typeof a.email === "string" && a.email.includes("@"))
      .sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0))
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function rememberAccount(email: string | null | undefined, name?: string | null) {
  if (!email || !email.includes("@")) return;
  try {
    const lower = email.trim().toLowerCase();
    const rest = listKnownAccounts().filter((a) => a.email.toLowerCase() !== lower);
    const next: KnownAccount[] = [{ email: email.trim(), name: name ?? null, lastUsed: Date.now() }, ...rest].slice(
      0,
      MAX,
    );
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function forgetAccount(email: string) {
  try {
    const lower = email.trim().toLowerCase();
    const next = listKnownAccounts().filter((a) => a.email.toLowerCase() !== lower);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
