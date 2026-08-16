// Server-only helpers for the pre-login ID lookup: name normalisation and
// rate limiting. Never import this from client-reachable module scope.
import { createHash } from "crypto";

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when `surname` matches any word of the roster's full name (or the
 * whole name). Handles double-barrelled surnames typed as one input.
 */
export function surnameMatches(fullName: string | null | undefined, surname: string): boolean {
  const name = normalizeName(fullName ?? "");
  const target = normalizeName(surname);
  if (!name || target.length < 2) return false;
  const nameWords = name.split(" ");
  const targetWords = target.split(" ");
  // every word the rider typed must appear in the roster name
  return targetWords.every((w) => w.length >= 2 && nameWords.includes(w));
}

export function hashIp(ip: string): string {
  const salt = process.env['ID_HASH_SALT'] ?? "rce-static-fallback-salt-change-me";
  return createHash("sha256").update(`ip:${salt}:${ip}`).digest("hex");
}

export function clientIpFrom(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    (headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ??
    "unknown"
  ) || "unknown";
}

const WINDOW_MINUTES = 10;
const MAX_PER_IP = 8;
const MAX_PER_ID = 5;

type Admin = { from: (t: string) => any };

/** Returns true when the caller is over the limit and should be refused. */
export async function isRateLimited(
  supabaseAdmin: Admin,
  ipHash: string,
  idHash: string,
): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const [byIp, byId] = await Promise.all([
    supabaseAdmin
      .from("id_lookup_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since),
    supabaseAdmin
      .from("id_lookup_attempts")
      .select("id", { count: "exact", head: true })
      .eq("id_hash", idHash)
      .gte("created_at", since),
  ]);
  return (byIp.count ?? 0) >= MAX_PER_IP || (byId.count ?? 0) >= MAX_PER_ID;
}

export async function recordAttempt(
  supabaseAdmin: Admin,
  ipHash: string,
  idHash: string,
  outcome: "hit" | "miss" | "blocked",
): Promise<void> {
  try {
    await supabaseAdmin
      .from("id_lookup_attempts")
      .insert({ ip_hash: ipHash, id_hash: idHash, outcome });
    // Opportunistic cleanup — keep only the last 24h.
    if (Math.random() < 0.05) {
      await supabaseAdmin
        .from("id_lookup_attempts")
        .delete()
        .lt("created_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString());
    }
  } catch {
    /* logging must never break the lookup */
  }
}

/** Pad every response to a constant duration so timing reveals nothing. */
export async function padTo(startedAt: number, ms = 900): Promise<void> {
  const remaining = ms - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
}
